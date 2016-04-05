// bot.js ~ Copyright 2016 Paul Beaudet ~ MIT License
var SERVER = 'http://192.168.1.84:3000'; // test on your local server
// var SERVER = 'https://telezumo.herokuapp.com'; // or add YOUR server here

var app = {
    initialize: function(){    // Application Constructor
        this.bindEvents();     // Bind Event Listeners
        $('#sConnect').hide(); // hide connection button until device is ready
        $('#refresh').hide();  // hide remote connection refresh button (socket.io)
        $('#videoBTN').hide(); // hide video button until video shows up
    },
    bindEvents: function() {   // Bind cordova events: 'load', 'deviceready', 'offline', and 'online'
        document.addEventListener('deviceready', this.onDeviceReady, false); // function to run when device ready
    },
    onDeviceReady: function() {                         // deviceready Event Handler
        sock.connect();                                 // socket connect event
        video.init();                                   // get bot video stream
        $('#sConnect').show().on('click', arduino.ask); // on click ask if we can connect to the arduino
    }
};

var arduino = {
    tempIn: '',  // empty string to hold incoming serial data
    ask: function(){serial.requestPermission(arduino.open, utils.error);},
    open: function(){
        $('#sConnect').text('retry');
        serial.open({baudRate: 9600, sleepOnPause: false}, function(msg){
            $('#sConnect').off().text('close').on('click', arduino.close);
            serial.registerReadCallback(arduino.read, utils.error);       // set read callback
            $('#status').text(msg);                                       // show status of serial port
        }, utils.error);
    },
    read: function(data){
        var view = new Uint8Array(data);
        if(view.length){
            for(var i=0; i < view.length; i++){
                if(view[i] == 13){
                    $('#output').text(arduino.tempIn); // output serialln
                    sock.send('data', arduino.tempIn); // relay read data to server
                    arduino.tempIn = '';               // reset temp in
                } else {
                    arduino.tempIn += unescape(escape(String.fromCharCode(view[i])));
                }
            }
        }
    },
    close: function(){
        serial.close(function(){
            $('#status').text('closed serial port');
            $('#sConnect').off().text('connect').on('click', arduino.ask); // onclick ask if we can connect to the arduino
        }, utils.error);
    },
    remote: function(data){serial.write(data, function(){$('#status2').text('sent ' + data);}, utils.error);}
}

// simplified adapter.js shims for webRTC browser differances
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.URL = window.URL || window.webkitURL;

var signal = {
    peer: null,
    peerConnect: function(amIfirst){
        signal.peer = new window.RTCPeerConnection({ 'iceServers': [{'url': 'stun:stun.l.google.com:19302'}] });
        signal.peer.onicecandidate = function (event) { // on address info being introspected from external "stun" server
            if (event.candidate != null) { sock.send('ice', JSON.stringify(event.candidate)); }
        }; // null === finished finding info to describe ones own address, ie "canidate" address paths
        signal.peer.onaddstream = video.remoteStream;  // display remote video stream when it comes in
        signal.peer.addStream(video.stream);           // make our video stream sharable
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
    init: function(){
        if(navigator.getUserMedia){
            navigator.getUserMedia({video: true, audio: true,}, function(stream){
                video.stream = stream;
                $('#videoBTN').show().on('click', function(){signal.peerConnect(true);});
            }, utils.error);
        } else {
            utils.error('Telepresence, not supported on this device');
        }
    },
    remoteStream: function(event){
        document.getElementById('remoteVid').src = window.URL.createObjectURL(event.stream);
    }
}

var utils = {error: function(err){$('#status2').text('error:'+err);}}

sock = {
    et: false,       // need to try to connect before getting to excited
    status: 'open',  // detects whether bot is being controled or not
    master: null,    // user allowed to control this bot
    connect: function(){
        try {sock.et = io.connect(SERVER);}                                        // see if server is available
        catch(err){$('#refresh').text('retry').show().on('click', sock.connect);}  // if not get option to refresh
        sock.et.on('connect', sock.init);                                          // on connection set event listeners
    },
    init: function(){
        $('#refresh').hide();
        sock.et.on('botFind', function(from){
            sock.et.emit('here', {id:from, status: sock.status});
        });
        sock.et.on('own', function(from){
            if(sock.master !== from){  // relinquish control case
                sock.master = from;    // robot's master is defined!
                sock.status = 'taken'; // denote robot is being controled for admins
                sock.et.emit('here', {id:'false', status:'taken'}); // broadcast bot has been taken
            }
        });
        sock.et.on('remote', arduino.remote);                              // relay remote control events
        sock.et.on('ice', function(info){signal.recepient(info, 'ice');}); // get ip information
        sock.et.on('sdp', function(info){signal.recepient(info, 'sdp');}); // get video codec information
    },
    send: function(type, data){
        if(sock.master){sock.et.emit(type, {to:sock.master, data:data});}
    },
}

app.initialize();
