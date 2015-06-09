// Copyright (c) 2015 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';

var inherits = require('util').inherits;
var LRUCache = require('lru-cache');

var BUCKET_RESET_DURATION = 1000;
// This is a dummy value until we nail down how, exactly, we'll be getting
// the actual rate limit from vorenus-controller.
var NUM_TOKENS = 100;

function PermissionsCache(options) {
    if (!(this instanceof PermissionsCache)) {
        return new PermissionsCache(options);
    }
    var self = this;

    self.options = options;
    PermissionsCache.super_.call(self, self.options);

    self.channel = self.options.channel;
    self.logger = self.options.logger;
    self._bucketIntervals = [];

    self.channel.statEvent.addListener(self.increment.bind(self));
}

inherits(PermissionsCache, LRUCache);

PermissionsCache.prototype.clearBuckets = function clearBuckets() {
    var self = this;
    for (var i = 0; i < self._bucketIntervals.length; i++) {
        clearInterval(self._bucketIntervals[i]);
    }
    self.reset();
};

PermissionsCache.prototype.increment = function increment(stat) {
    var self = this;
    if (stat.name === 'inbound.calls.recvd' && stat.type === 'counter') {
        var key = createCallsKey(
            stat.tags['calling-service'], stat.tags.service
        );
        var tokens = self.get(key);
        if (typeof tokens === 'undefined') {
            self.initializeTokenBucket(key);
            tokens = self.get(key);
        }

        self.set(key, tokens - 1);
    }
};

PermissionsCache.prototype.initializeTokenBucket =
function initializeTokenBucket(key) {
    var self = this;
    
    resetTokens();
    self._bucketIntervals.push(setInterval(resetTokens, BUCKET_RESET_DURATION));

    function resetTokens() {
        self.set(key, NUM_TOKENS);
    }
};

function createCallsKey(caller, callee) {
    return caller + '_' + callee;
}

module.exports = PermissionsCache;
