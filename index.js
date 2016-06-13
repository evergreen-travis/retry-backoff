'use strict'

var debug = require('debug')('retry-backoff')
var isRetryAllowed = require('is-retry-allowed')
var streamCb = require('stream-callback')
var timeout = require('callback-timeout')
var isStream = require('is-stream')

var DEFAULT = {
  retries: 5,
  timeout: 0
}

function calculateBackoff (seed) {
  var noise = Math.random() * 100
  return (1 << seed) * 1000 + noise
}

function retryBackoff (opts) {
  opts = Object.assign(DEFAULT, opts)

  var retryCount = 0

  function backoff (fn, cb) {
    var args = arguments
    if (isStream(fn)) fn = streamCb.bind(streamCb, fn)

    function handleCallback (err) {
      if (!err) return cb.apply(cb, arguments)
      if (err && err.name === 'TimeoutError') err = {code: 'ETIMEDOUT'}

      ++retryCount
      var retry

      if (retryCount > opts.retries || !isRetryAllowed(err)) retry = 0
      else retry = calculateBackoff(retryCount)

      if (!retry) return cb.apply(cb, arguments)

      setTimeout(function () {
        debug('retry: %sms', retry)
        return backoff.apply(fn, args)
      }, retry)
    }

    return fn(timeout(handleCallback, opts.timeout))
  }

  backoff.reset = function reset () {
    retryCount = 0
  }

  return backoff
}

module.exports = retryBackoff
