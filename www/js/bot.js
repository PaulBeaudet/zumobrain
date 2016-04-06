// bot.js ~ Copyright 2016 Paul Beaudet ~ MIT License
// var SERVER = 'http://192.168.1.84:3000'; // test on YOUR local server here
var SERVER = 'https://telezumo.herokuapp.com'; // or add YOUR public server here

var arduino = {  // code for controling the arduino, NOTE: braided w/socket events
    tempIn: '',  // empty string to hold incoming serial data
    ask: function(){serial.requestPermission(arduino.open, function(err){ // if permission granted open serial port
        utils.error(err);                                                                        // else show error
        $('#sConnect').show().off().text('USB pemission needed:Retry').on('click', arduino.ask); // try again option
    });},
    open: function(){
        serial.open({baudRate: 9600, sleepOnPause: false}, function(msg){        // provide settings and success callback
            sock.broadcastState('open');                                         // broadcast readyness to remotes
            $('#sConnect').show().off().text('stop').on('click', arduino.close); // give ability to close connection
            serial.registerReadCallback(arduino.read, utils.error);              // set read callback
            $('#status').text(msg);                                              // show status of serial port
        }, function(err){                                                        // on failed to open callback
            $('#sConnect').show().off().text('Failed talking to bot:Retry').on('click', arduino.open);
            utils.error(err);                                                    // log out fail message
        });
    },
    read: function(rawBuffer){                         // read incoming data from the arduino
        var buffer = new Uint8Array(rawBuffer);        // turn raw buffer into something we can understand
        if(buffer.length){                             // if there are bytes in buffer
            for(var i=0; i < buffer.length; i++){      // for bytes that we got
                if(buffer[i] == 13){                   // if on new line byte
                    $('#output').text(arduino.tempIn); //   output serialln
                    sock.send('data', arduino.tempIn); //   relay read data to server
                    arduino.tempIn = '';               //   reset temp in
                } else {                               // if case of any other byte add it to a pesistent string
                    arduino.tempIn += unescape(escape(String.fromCharCode(buffer[i])));
                }
            }
        }
    },
    close: function(){
        serial.close(function(){
            $('#status').text('closed serial port and remote connections'); // show what just happend
            sock.broadcastState('down');                                    // broadcast downed status to remotes
            $('#sConnect').off().text('connect').on('click', arduino.ask);  // onclick ask if we can connect to the arduino
        }, utils.error);
    },
    remote: function(data){serial.write(data, function(){$('#status2').text('sent ' + data);}, utils.error);}
}

// simplified adapter.js shims for webRTC browser differances AKA bs garble de gook
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.URL = window.URL || window.webkitURL;

var signal = {
    peer: null, // placeholder for our peer connection object
    peerConnect: function(amIfirst){
        if(video.stream){
            signal.peer = new window.RTCPeerConnection({ 'iceServers': [{'url': 'stun:stun.l.google.com:19302'}] });
            signal.peer.onicecandidate = function (event) { // on address info being introspected
                if (event.candidate != null) { sock.send('ice', JSON.stringify(event.candidate)); }
            }; // null === finished finding info to describe ones own address, ie "canidate" address paths
            signal.peer.onaddstream = video.remoteStream;   // display remote video stream when it comes in
            signal.peer.addStream(video.stream);            // make our video stream sharable
        }
        if(amIfirst){ signal.peer.createOffer(signal.onSession, utils.error);}
    },
    recepient: function(info, type){
        if(!signal.peer){signal.peerConnect(false);} // start peer connection if someone is calling
        if(type === 'ice'){                          // given adress info from remote is being handled
            signal.peer.addIceCandidate(new window.RTCIceCandidate(JSON.parse(info))); // add address info
        } else { // otherwise we are getting signal type data i.e. audeo video codec description
            signal.peer.setRemoteDescription(new window.RTCSessionDescription(JSON.parse(info)), function(){
                signal.peer.createAnswer(signal.onSession, utils.error);
            }, utils.error); // try to find common ground on codecs
        }
    },
    onSession: function(info){
        signal.peer.setLocalDescription(info, function(){
            sock.send('sdp', JSON.stringify(signal.peer.localDescription)); // send discription of connection type
        }, utils.error);
    },
}

var video = {
    stream: null,
    get: function(){
        if(navigator.getUserMedia){
            navigator.getUserMedia({video: true, audio: true,}, function(stream){
                video.stream = stream;
            }, utils.error);
        } else { utils.error('Telepresence, not supported on this device'); }
    },
    remoteStream: function(event){
        document.getElementById('remoteVid').src = window.URL.createObjectURL(event.stream);
    }
}

var utils = {error: function(err){$('#status2').text('error:'+err);}}

sock = {             // socket.io event listeners and variables for bot status
    et: false,       // need to try to connect before getting to excited
    status: 'down',  // detects whether bot is being controled or not
    master: null,    // user allowed to control this bot
    init: function(){
        sock.et.on('botFind', function(from){sock.et.emit('here', {id:from, status: sock.status});});
        sock.et.on('own', function(from){ // listen for a remote to take control
            signal.peerConnect(true);     // share our video w/ master
            sock.master = from;           // yousa gone save my life! mesa you slave
            sock.broadcastState('taken'); // broadcast newfound enslavement of remote overlord
        });
        sock.et.on('relinquish', function(master){ // NOTE this is a broadcasted event we are listening for
            if(master === sock.master){            // check if this is our master that has bared the gift of a sock
                sock.master = null;                // Dolby is FREEEE!
                if(sock.status === 'taken'){       // only if previously taken
                    sock.broadcastState('open');   // broadcast newfound freedom
                }
            }
        });
        sock.et.on('remote', arduino.remote);                              // relay remote control events
        sock.et.on('ice', function(info){signal.recepient(info, 'ice');}); // get ip information
        sock.et.on('sdp', function(info){signal.recepient(info, 'sdp');}); // get video codec information
    },
    send: function(type, data){
        if(sock.master){sock.et.emit(type, {to:sock.master, data:data});}
    },
    broadcastState: function(state){
        sock.status = state; // set status persitently so we can respond to indivdual botFind calls
        sock.et.emit('here', {id:false, status:state}); // Broadcast status
    }
}

var app = {                    // event listeners for cordova
    initialize: function(){    // Application Constructor
        this.bindEvents();     // Bind Event Listeners
        $('#sConnect').hide(); // hide connection button until device is ready (arduino)
        $('#refresh').hide();  // hide remote connection refresh button (socket.io)
    },
    bindEvents: function() {   // Bind cordova events: 'load', 'deviceready', 'offline', and 'online'
        document.addEventListener('deviceready', app.start); // function to run when device ready
    },
    start: function(){
        try {sock.et = io.connect(SERVER);}                                    // see if server is available
        catch(err){$('#refresh').text('retry').show().on('click', app.start);} // if not get option to refresh
        sock.et.on('connect', function(){                                      // on succesfull connection to server
            $('#refresh').hide();                                              // hide refresh button if it was shown
            sock.init();                                                       // set event listeners
            video.get();                                                       // get video if it is availible
            arduino.ask();                                                     // ask for permission to use USB
        });
    }
};

app.initialize(); // read upwards app starts here
