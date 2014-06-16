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

var _ = require('lodash');
var csvStream = require('csv-streamify');
var moment = require('moment');

var transformers = require('./transformers.js');

exports.fetch = require('./fetch.js');

exports.parse = function (inStream, config) {
  var startTime = null;
  var configFn = function() {
    return _.assign({ startTime: startTime }, config);
  };

  return rx.Node.fromStream(inStream)
    .readline()
    // The carelink CSV has a preamble that we mostly don't really care about, so skip it
    .skipWhile(function (line) {
                 return line.indexOf('Data Range,') !== 0;
               })
    // The part of the preamble that we care about is the date range for the data in the CSV.
    // We use this to figure out the earliest timestamp represented by the data set.
    .map(function(e) {
            if (startTime == null) {
              var startTimeString = e.split(',')[1];
              startTime = moment.utc(startTimeString, 'MM/DD/YY HH:mm:ss');
              return '';
            }
            return e;
          })
    .passThroughStream(csvStream({objectMode: true, columns: true, empty: null}))
    .apply(transformers(configFn));
};