'use strict';

import {Endpoint} from 'vis-commons';
import shoe       from 'shoe';
import through    from 'through';

export default
class ImgEndpoint extends Endpoint {

  installRoutes () {
    for (let [route, handler] of this.getRoutes()) {
      shoe(handler).install(this.server, route);
    }
  }

  getRoutes () {
    return Object.entries({
      '/tournaments'   : this.tournaments.bind(this),
      '/live'          : this.live.bind(this),
      '/event'         : this.listenToSubscription.bind(this)
    });
  }

  tournaments (stream) {
    stream.
      pipe(streamify(msg => JSON.parse(msg))).
      pipe(streamify(msg => 
        msg.action === 'getEvents' &&
          this.getEvents(msg.tournamentId, stream).
            then(events =>
              stream.write(marshalize('events', events)))));

    return this.fetchByKeys('vis:img:tournaments:*:data').
      then(writeTo(stream, 'tournaments'));
  }

  fetchByKeys (pattern) {
    return this.redis.keys(pattern).
      then(keys => keys && keys.length ? keys : Promise.reject('NO_KEYS')).
      then(keys => this.redis.mget(keys)).
      then(data => data.map(t=>JSON.parse(t))).
      catch(reason => reason === 'NO_KEYS' && []);
  }

  live (stream) {
    this.getLives().
      then(writeTo(stream, 'live'));

    this.pubsub.on('vis:img:live', writeTo(stream, 'live'));
    this.listenToSubscription (stream);
  }

  listenToSubscription (stream) {
    stream.
      pipe(streamify(msg => JSON.parse(msg))).
      pipe(through(({subscribe}) =>
        this.subscribe(stream, subscribe)));
  }

  subscribe (stream, eventId) {
    console.log('Subscribed to', eventId);

    this.getMatchHistory(eventId).
      then(writeTo(stream, 'history'));

    this.getEventDetails(eventId).
      then(writeTo(stream, 'generic'));

    this.pubsub.on(`vis:img:events:${eventId}:stream`, msg =>
      writeTo(stream, 'incident')(msg.content));
  }

  getEventDetails (eventId) {
    return this.redis.get(`vis:img:events:${eventId}:details`).
      then(JSON.parse);
  }

  getMatchHistory (eventId) {
    return this.fetchByKeys(`vis:img:events:${eventId}:stream:*`);
  }

  getTournaments () {
    return this.fetchByKeys('vis:img:tournaments:*:data');
  }

  getLives () {
    return this.redis.get('vis:img:live').
      then(JSON.parse);
  }

  getEvents (tournamentId) {
    const pattern = `vis:img:tournaments:${tournamentId || '*'}:events:*`;
    return this.fetchByKeys(pattern);
  }

  log (stuff) {
    console.log('LOGGING', stuff);
    return stuff;
  }

  events (stream, params) {
    return this.img.events(params.tournamentId).
      then(writeTo(stream, 'events'));
  }
}

function writeTo (stream, action) {
  return data => (stream.write(marshalize(action, data)), stream);
}

function marshalize (action, data) {
  return JSON.stringify({
    action: action,
    data: data
  });
}

function parseChunk (msg) {
  console.log('GOT:', JSON.parse(msg).action);
  this.queue(msg);
}

function streamify (callback) {
  return through(function(msg){
    this.push(callback(msg));
  });
}