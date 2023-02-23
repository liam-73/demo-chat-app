const path = require('path');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/message');
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require('./utils/user');

const express = require('express');
const app = express();

const server = require('http').createServer(app);
const io = require('socket.io')(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

app.use(express.static(publicDirectoryPath));

io.on('connection', (socket) => {
  console.log('New web socket connection');

  socket.on('join', (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options });

    if (error) return callback(error);

    const { username, room } = user;

    socket.join(options.room);

    socket.emit('message', generateMessage('Admin', 'Welcome'));
    socket.broadcast
      .to(room)
      .emit('message', generateMessage(`${username} has joined!`));

    io.to(room).emit('roomData', {
      room,
      users: getUsersInRoom(room),
    });

    callback();
  });

  socket.on('sendMessage', (message, cb) => {
    const user = getUser(socket.id);
    const filter = new Filter();

    if (filter.isProfane(message)) return cb('Profanity is not allowed');

    io.to(user.room).emit('message', generateMessage(user.username, message));
    cb();
  });

  socket.on('share-location', ({ latitude, longitude }, cb) => {
    const user = getUser(socket.id);

    io.to(user.room).emit(
      'locationMessage',
      generateLocationMessage(
        user.username,
        `https://google.com/maps?q=${latitude},${longitude}`,
      ),
    );

    cb();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    const { username, room } = user;

    if (user)
      io.to(room).emit('message', generateMessage(`${username} has left!`));
    io.to(room).emit('roomData', {
      room,
      users: getUsersInRoom(room),
    });
  });
});

server.listen(port, () => console.log(`Server is up on localhost:${port}`));
