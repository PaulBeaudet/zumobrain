// bot.js ~ Copyright 2016 Paul Beaudet ~ MIT License
var SERVER = 'http://192.168.1.84:3000';

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
    ask: function(){serial.requestPermission(arduino.open, arduino.error);},
    open: function(){
        $('#sConnect').off().text('close').on('click', arduino.close);
        serial.open({baudRate: 9600, sleepOnPause: false}, function(msg){
            serial.registerReadCallback(arduino.read, arduino.error);     // set read callback
            $('#status').text(msg);                                       // show status of serial port
            $('.navbar').show();                                          // show navbar to send serial data
        }, arduino.error);
    },
    send: function(){
        var text = $('#textEntry').val();
        if(text){
            serial.write(text, function(){$('#textEntry').val('');}, arduino.error);
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
    error: function(){return function(msg){$('#status').text('Error: ' + msg);}},
    close: function(){
        serial.close(function(){
            $('#status').text('closed serial port');
            $('.navbar').hide();
            $('#sConnect').off().text('connect').on('click', arduino.ask); // on click ask if we can connect to the arduino
        }, arduino.error);
    },
    remote: function(data){
        $('#status').text('sent ' + data);
        serial.write(data, function(){$('#status2').text('sent ' + data);}, arduino.error);
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
    },
    init: function(){
        $('#remote').hide();
        sock.et.on('remote', arduino.remote);
    },
}

app.initialize();
