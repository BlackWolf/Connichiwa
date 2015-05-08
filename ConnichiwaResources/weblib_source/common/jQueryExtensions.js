'use strict';

;(function($) {
  $(function() {
    /**
     * This method takes an arrya of deferred objects and returns a new
     *    "master" deferred object. The master will wait for all passed
     *    deferreds to either resolve or fail. It will then:
     *
     * * Be resolved if all deferreds were resolved * Fail if one or more
     *    deferreds failed
     *
     * In contrast to passing multiple deferreds to jQuery's $.when directly,
     *    the master deferred is not immediately rejected as soon as a single
     *    deferred fails. Instead, it waits for all deferreds to resolve or
     *    reject.
     * @copyright Roman Rädle <roman.raedle at uni-konstanz.de >
     * @param  {Array} deferreds An array of jQuery Deferred objects
     * @return {$.Deferred} A jQuery Deferred object that is rejected or
     *    resolved when all passed deferreds have been rejected or resolved
     */
    $.when.all = function(deferreds) {
      var masterDeferred = new $.Deferred();

      //Walk over all our deferreds and wait for all of them to either 
      //resolve or fail:
      //* When all have resolved, resolve the master
      //* When one or more fail, reject the master
      var remaining = deferreds.length;
      var anyReject = false;
      $.each(deferreds, function(i, deferred) {
        deferred.fail(function() {
          anyReject = true;
        }).always(function() {
          remaining--;
          if (remaining === 0) {
            if (anyReject) masterDeferred.reject();
            else masterDeferred.resolve();
          }
        });
      });

      return masterDeferred;
    };
  });
})(jQuery);
