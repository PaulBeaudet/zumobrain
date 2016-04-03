// bot.js ~ Copyright 2016 Paul Beaudet ~ MIT License
var SERVER = 'https://telezumo.herokuapp.com';

var app = {
    initialize: function(){    // Application Constructor
        this.bindEvents();     // Bind Event Listeners
        $('.navbar').hide();   // hide navbar by defualt
        $('#sConnect').hide(); // hide connection button until device is ready
        $('#remote').hide();   // hide remote connection button
        $('#videoBTN').hide(); // hide video button until video shows up
    },
    bindEvents: function() {   // Bind cordova events: 'load', 'deviceready', 'offline', and 'online'
        document.addEventListener('deviceready', this.onDeviceReady, false); // function to run when device ready
    },
    onDeviceReady: function() {                         // deviceready Event Handler
        sock.connect();                                 // socket connect event
        video.init();                                   // get bot video stream
        $('#sConnect').show().on('click', arduino.ask); // on click ask if we can connect to the arduino
        $('#sendButton').on('click', arduino.send);     // send typed data in textEntry space
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
            $('.navbar').show();                                          // show navbar to send serial data
        }, utils.error);
    },
    send: function(){
        var text = $('#textEntry').val();
        if(text){
            serial.write(text, function(){$('#textEntry').val('');}, utils.error);
        } else {$('#status').text('nothing entered');}
    },
    read: function(data){
        var view = new Uint8Array(data);
        if(view.length){
            for(var i=0; i < view.length; i++){
                if(view[i] == 13){
                    $('#output').text(arduino.tempIn);  // print serialln
                    arduino.tempIn = '';                // reset temp in
                } else {
                    arduino.tempIn += unescape(escape(String.fromCharCode(view[i])));
                }
            }
        }
    },
    close: function(){
        serial.close(function(){
            $('#status').text('closed serial port');
            $('.navbar').hide();
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
        signal.peer.onicecandidate = function (event) { // send any ice candidates to the other peer
            if (event.candidate != null) {
                sock.et.emit('ice', JSON.stringify(event.candidate));
            } // else a null means we have finished finding ice canidates in which there
        };    // in which there may be multiple of for any given client
        signal.peer.onaddstream = video.remoteStream;
        signal.peer.addStream(video.stream);
        if(amIfirst) { signal.peer.createOffer(signal.onSession, utils.error);}
    },
    recepient: function(info, type){
        if(!signal.peer){signal.peerConnect(false);} // start peer connection if someone is calling
        if(type === 'ice'){
            signal.peer.addIceCandidate(new window.RTCIceCandidate(JSON.parse(info)));
        } else {
            signal.peer.setRemoteDescription(new window.RTCSessionDescription(JSON.parse(info)), function(){
                signal.peer.createAnswer(signal.onSession, utils.error);
            });
        }
    },
    onSession: function(info){
        signal.peer.setLocalDescription(info, function(){
            sock.et.emit('sdp', JSON.stringify(signal.peer.localDescription)); // send discription of connection type
        }, utils.error);
    },
}

var video = {
    stream: null,
    init: function(){
        navigator.getUserMedia({video: true, audio: false,}, function(stream){
            video.stream = stream;
            document.getElementById('localVid').src = window.URL.createObjectURL(stream);
            $('#videoBTN').show().on('click', function(){signal.peerConnect(true);});
        }, utils.error);
    },
    remoteStream: function(event){
        document.getElementById('remoteVid').src = window.URL.createObjectURL(event.stream);
    }
}

var utils = {
    error: function(err){$('#status2').text('error:'+err);}
}

sock = {
    et: false,  // need to try to connect before getting to excited
    connect: function(){
        try {sock.et = io.connect(SERVER);}
        catch(err){
            $('#remote').text('retry').show().on('click', sock.connect);
            alert(err);
        }
        sock.et.on('connect', sock.init);
        // Signaling reactions
        sock.et.on('ice', function(info){signal.recepient(info, 'ice');});
        sock.et.on('sdp', function(info){signal.recepient(info, 'sdp');});
    },
    init: function(){
        $('#remote').hide();
        sock.et.on('remote', arduino.remote);
    },
}

app.initialize();
