define([
  'core/core',
  'events/pubsub'
],
function(core, pubsub) {
  'use strict';

  describe('core.core', function () {
    it('should have a version', function () {
      expect(core.version).toBeDefined();
    });

    it('should have components loaded', function () {
      expect(core.components).toBeDefined();
    });

    it('should have data collection exposed', function () {
      expect(core.dataCollection).toBeDefined();
    });

    it('should have pubsub exposed', function () {
      expect(core.pubsub).toBeDefined();
    });

    it('should have the global pubsub exposed', function () {
      expect(core.globalPubsub).toBe(pubsub.getSingleton());
    });

  });

});
