/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 * 
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */
'use strict';

var rx = require('rx');

/**
 * A self-join is a join operation done on a single stream of objects.
 *
 * The idea is basically to run through all events and check if any "builders" know how to handle them.
 * If a builder does know how to handle it, it gives us a "handler" that we can use to join together that
 * event with events that will come in the future.
 *
 * If we have a handler, we delegate all events to it. Once the handler returns an array of events to emit,
 * then those events are emitted and the handler is cleared
 *
 * Note that selfJoin is recursive.  When you events are emitted, those events are pushed back
 * through the set of handlers before being passed on.  This allows you to build up joins with smaller
 * pieces of individual logic.
 *
 * @param eventStream an Observable to have its bolus events self-joined.
 */
rx.Observable.prototype.selfJoin = function(builderFns) {
  var eventStream = this;
  var handler = null;

  if (!Array.isArray(builderFns)) {
    builderFns = [builderFns];
  }

  return rx.Observable.create(
    function (obs) {
      function processEvent(e) {
        if (handler == null) {
          for (var i = 0; i < builderFns.length && handler == null; ++i) {
            handler = builderFns[i](e);
          }
        }

        if (handler == null) {
          obs.onNext(e);
        } else {
          var results;
          try {
            results = handler.handle(e);
          } catch (err) {
            obs.onError(err);
          }

          if (results != null) {
            handler = null;
            results.forEach(processEvent);
          }
        }
      }

      eventStream.subscribe(
        processEvent,
        function (err) {
          obs.onError(err);
        },
        function () {
          while (handler != null) {
            var handlerRef = handler;
            handler = null;
            handlerRef.completed().forEach(processEvent);
          }
          obs.onCompleted();
        }
      );
    }
  );
};

exports.required = true;