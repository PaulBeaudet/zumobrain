// bot.js ~ Copyright 2016 Paul Beaudet ~ MIT License
var SERVER = 'https://telezumo.herokuapp.com';

var app = {
    initialize: function(){    // Application Constructor
        this.bindEvents();     // Bind Event Listeners
        $('.navbar').hide();   // hide navbar by defualt
        $('#sConnect').hide(); // hide connection button until device is ready
        $('#remote').hide();   // hide remote connection button
    },
    bindEvents: function() {   // Bind cordova events: 'load', 'deviceready', 'offline', and 'online'
        document.addEventListener('deviceready', this.onDeviceReady, false); // function to run when device ready
    },
    onDeviceReady: function() {                         // deviceready Event Handler
        sock.connect();                                 // socket connect event
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

var rtc = { // simplified adapter.js shim for webRTC browser differances
    getUserMedia: navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia,
    peerConnection: window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection,
    iceCandidate: window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate,
    sessionInfo: window.RTCSessionDescription || window.mozRTCSessionDescription ||   window.webkitRTCSessionDescription,
    url: window.URL || window.webkitURL, // for attaching video urls as source discriptions
}

var signal = {
    peer: null,
    peerConnect: function(amIfirst){
        signal.peer = new rtc.peerConnection({ 'iceServers': [{'url': 'stun:stun.l.google.com:19302'}] });
        signal.peer.onicecandidate = function (event) { // send any ice candidates to the other peer
            if (event.candidate != null) {
                sock.et.emit('ice', event.candidate);
            } // else a null means we have finished finding ice canidates in which there
        };    // in which there may be multiple of for any given client
        // signal.peer.onaddstream = video.remoteStream; // only need to send stream out for now
        signal.peer.addStream(video.stream);
        if(amIfirst) { signal.peer.createOffer(signal.onSession, utils.error);}
    },
    recepient: function(info, type){
        if(!signal.peer){signal.peerConnect(false);} // start peer connection if someone is calling
        if(type === 'ice'){
            signal.peer.addIceCandidate(new rtc.iceCandidate(info.ice));
        } else {
            signal.peer.setRemoteDescription(new rtc.sessionInfo(info.sdp), function(){
                signal.peer.createAnswer(signal.onSession, utils.error);
            });
        }
    },
    onSession: function(info){
        signal.peer.setLocalDescription(info, function(){
            sock.et.emit('sdp', signal.peer.localDescription); // send discription of connection type
        }, utils.error);
    },
}

var utils = {
    error: function(err){$('#status2').text('error:'+err);}
}

var video = {
    stream: null,
    init: function(){
        rtc.getUserMedia({video: true, audio: true,}, function(stream){
            video.stream = stream;
            document.getElementById('localVid').src = rtc.url.createObjectURL(stream);
        }, utils.error);
    },
    remoteStream: function(event){
        document.getElementById('remoteVid').src = rtc.url.createObjectURL(event.stream);
    }
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
