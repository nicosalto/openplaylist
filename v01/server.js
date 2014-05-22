//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

router.use(express.static(path.resolve(__dirname, 'client')));
var messages = [];
var links = [];
var history = [];
var sockets = [];
var votes = {'keep':0,'skip':0, 'users':0};
var voters = [];
var playing = 'none';
var playbutton = {'action':'play','track':'' };

io.on('connection', function (socket) {
    
    messages.forEach(function (data) {
      socket.emit('message', data);
    });
    
    links.forEach(function (data) {
      socket.emit('track', data);
    });  
    
    history.forEach(function (data) {
      socket.emit('history', data);
    });
    
    socket.emit('playing', playing);
    socket.emit('playbutton', playbutton);
    
    socket.emit('votes', votes);
    
    sockets.push(socket);
    
    socket.on('disconnect', function () {
      sockets.splice(sockets.indexOf(socket), 1);
      updateRoster();
    });
    
    
    socket.on('message', function (msg) {
      var text = String(msg || '');
      if (!text)
        return;
      socket.get('name', function (err, name) {
        var data = {
          name: name,
          text: text
        };
        broadcast('message', data);
        messages.push(data);
      });
    });

    socket.on('track', function (lnk) {
        console.log(lnk);
        lnk.time = getthetime();
        broadcast('track', lnk);
        links.push(lnk);
    });
    
    
    socket.on('votes', function (vote) {
        
        if (voters.indexOf(vote.user) == -1){
            
            console.log(vote);
            if (vote.type == "keep"){
                votes.keep = votes.keep + 1;
            }else if(vote.type == "skip"){
                votes.skip = votes.skip + 1;
            }
            
            votes.users = sockets.length;
            voters.push(vote.user);
            
            broadcast('votes', votes);
        }
    });
    
    
    //http://gdata.youtube.com/feeds/api/videos/ylLzyHk54Z0?v=2&alt=jsonc
    
    socket.on('play', function (user) {

        if (playbutton == 'play'){
            
            playbutton = 'pause';
            broadcast('playbutton', {'action':playbutton,'track':'' }); //change button to pause
            
            if (playing == 'none'){
                if (links.length > 0){
                    playing = links[0]; //playing first link of the playlist
                    links.splice(0,1); //removing this link from playlist
                    broadcast('playing', playing);//start playing it
                    broadcast('updateTrack', links);
                }
            }
            broadcast('history', {'message' : 'playing :'+playing['title'] ,'time': getthetime(),'user':user } ); //add link to history

            
        }else if(playbutton == 'pause'){
            broadcast('history', {'message' : 'paused :'+playing['title'] ,'time': getthetime(),'user':user } ); //add link to history
            playbutton = 'play';
            broadcast('playbutton', {'action':playbutton,'track':'' });
        }
    });
    
    
    socket.on('skip', function (data) {
        
        if (links.length > 0){
            //console.log('skip '+data.youtubeid+' = '+playing.youtubeid);
            if(playing.youtubeid == data.youtubeid || playing == 'none' ){
                if (data.from == 'user'){
                    broadcast('history', {'message' : ' skipped :'+playing.title ,'time': getthetime(),'user':'users' } ); //add link to history
                }
                playbutton = 'pause';
                broadcast('playbutton', {'action':'skip','track':links[0] }); //change button to pause
                
                playing = links[0]; //playing first link of the playlist
                links.splice(0,1); //removing this link from playlist
                broadcast('playing', playing);//start playing it
                broadcast('updateTrack', links);//remove link from playlist
                
                votes = {'keep':0,'skip':0, 'users':0}; // clear the voting system
                voters = []; // clear the voting system
                broadcast('votes', votes);
                
                broadcast('history', {'message' : ' playing :'+playing.title ,'time': getthetime(),'user':'' } ); //add link to history
            }
        }
    });
    
    socket.on('identify', function (name) {
      socket.set('name', String(name || 'Anonymous'), function (err) {
        updateRoster();
        
        if(playing != 'none'){
            socket.emit('playbutton', {'action':'skip','track':playing });
        }
        
      });
    });
    
  });


        
function getthetime(){
    var date = new Date();
    var hour = date.getHours();
    var minute = date.getMinutes();
    var second = date.getSeconds();
    return hour+':'+minute+':'+second;
}

function updateRoster() {
  async.map(
    sockets,
    function (socket, callback) {
      socket.get('name', callback);
    },
    function (err, names) {
      broadcast('roster', names);
    }
  );
}

function broadcast(event, data) {
  sockets.forEach(function (socket) {
    socket.emit(event, data);
  });
}

server.listen(process.env.PORT || 80, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});
