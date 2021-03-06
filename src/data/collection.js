/**
 * @fileOverview
 * Data source mutators.
 */
define([
  'core/object',
  'core/array',
  'core/set',
  'data/selection/selection',
  'events/pubsub',
  'data/selection/diff-quotient',
  'data/selection/stack'
], function (obj, array, set, selection, pubsub) {
  'use strict';

  /**
   * Computes the derivation by calling the
   * derivation function with the sources it needs.
   */
  function applyDerivation(dc, data) {
    var dataSelections, derivedData;
    dataSelections = resolveSources(data.sources, dc).map(dc.select.bind(dc));
    derivedData = data.derivation.apply(null, dataSelections);
    if (typeof derivedData === 'object' &&
         !Array.isArray(derivedData)) {
      obj.extend(derivedData, data);
    }
    return derivedData;
  }

  function getScopeFn(scope) {
    return pubsub.scope(scope);
  }

  /**
   * A data config is determined to derived config if
   * it contains a sources or derivation field.
   */
  function isDerivedDataConfig(data) {
    if (data) {
      return  obj.isDef(data.sources) ||
              obj.isDef(data.derivation);
    }
    return false;
  }

  /**
   * Adds a data source.
   * Tags non-derived sources with * and +.
   * Tags derived sources with +.
   */
  function addDataSource(dataCollection, data) {
    var id = data.id;
    if (isDerivedDataConfig(data)) {
      if (!obj.isDef(data.tags)) {
        data.tags = '+';
      }
      dataCollection[id] = { glDerive: data };
    } else {
      if (!obj.isDef(data.tags)) {
        data.tags = ['*', '+'];
      }
      dataCollection[id] = data;
    }
  }

  /**
   * Takes a list of sources (comma delimited list of ids or tags) and
   * resolves them to the corresposing array of array of ids.
   */
  function resolveSources(sources, dc) {
    return array.getArray(d3.functor(sources)(dc.resolve.bind(dc)))
      .map(function(source) {
        return dc.resolve(source);
      });
  }

  /**
   * @private
   * Derives data source by id.
   * Accepts the cached deps object.
   * Results in the derivation of any non-cached dependencies
   * of the data source.
   *
   * This creates a dependency graph and checks for circular dependencies.
   */
  function deriveDataById(id, data, deps, dataCollection, visited) {
    var d = data[id], sources;
    if(!dataCollection.isDerived(id)) {
      deps[id] = true;
      return;
    }
    visited = visited || [];
    if (deps[id]) {
      return;
    }
    if (array.contains(visited, id)) {
      deps[id] = true;
      // TODO: Make enum for errors.
      d.glDerivation = 'gl-error-circular-dependency';
    }
    visited.push(id);
    sources = [];
    resolveSources(d.glDerive.sources, dataCollection)
      .forEach(function(source) {
        sources = sources.concat(source);
      });
    sources.forEach(function(id) {
      deriveDataById(id.trim(), data, deps, dataCollection, visited);
    });
    deps[id] = true;
    d.glDerivation = applyDerivation(dataCollection, d.glDerive);
  }

  /**
   * Constructor for the collection.
   */
  function collection() {
    var dataCollection = {},
        globalPubsub = pubsub.getSingleton();

    return {

      /**
      * Event dispatcher.
      * @public
      */
      dispatch: d3.dispatch('error'),

      /**
       * Add a data source.
       * dispatch error event if id is not unique
       */
      add: function(data) {
        if (Array.isArray(data)) {
          data.forEach(this.add, this);
          return;
        }
        if (dataCollection[data.id]) {
          this.dispatch.error();
          return;
        }
        addDataSource(dataCollection, data);
      },

      /**
       * Adds a data source if it doesn't exist.
       * Replace a data source if it does.
       */
      upsert: function(data) {
        if (!dataCollection[data.id]) {
          this.add(data);
        }
        addDataSource(dataCollection, data);
      },

      /**
       * Determines whether a data is standard or derived.
       * Returns true if data is derived if an is provided.
       */
      isDerived: function(id) {
        var data = dataCollection[id];
        return obj.isDef(data) && obj.isDef(data.glDerive);
      },

      /**
       * Creates a dependency graph and uses it to recalculate
       * derived sources based on the right order.
       * If a circular dependency is encountered, that data source
       * will be injected as 'gl-error-circular-dependency'
       */
      updateDerivations: function() {
        var deps = {};
        Object.keys(dataCollection).forEach(function(k) {
          deriveDataById(k, dataCollection, deps, this);
        }, this);
        return deps;
      },

      /**
       * Remove a data source by id.
       */
      remove: function(id) {
        var ids = array.getArray(id);
        ids.forEach(function(i) {
          delete dataCollection[i];
        });
      },

      /**
       * Takes a selection query and resolves it into
       * the corresponding array of ids.
       */
      resolve: function(selection) {
        var sources = selection.split(','),
            ids = [];
        sources.forEach(function(src) {
          var source = src.trim();
          if (dataCollection[source]) {
            ids.push(source);
          } else {
            Object.keys(dataCollection).forEach(function(k) {
              if (this.hasTags(k, source)) {
                ids.push(k);
              }
            }, this);
          }
        }, this);
        return ids;
      },

      /**
       * Extend a data-source in place.
       * If data source doesn't exist, it's added.
       */
      extend: function(data) {
        var id = data.id;
        if (dataCollection[id]) {
          obj.extend(dataCollection[id], data);
        } else {
          this.add(data);
        }
      },

      /**
       * Append data to a source by id.
       */
      append: function(id, dataToAppend) {
        var dataSource = this.get(id);
        if (dataSource) {
          if (Array.isArray(dataToAppend)) {
            array.append(dataSource.data, dataToAppend);
          } else {
            dataSource.data.push(dataToAppend);
          }
        }
      },

      /**
       * Returns the tag(s) of the datasource speciifed by its id.
       */
      getTags: function(id) {
        var tags;
        if (this.isDerived(id)) {
          tags = obj.get(dataCollection, [id, 'glDerive', 'tags']);
        } else {
          tags = obj.get(dataCollection, [id, 'tags']);
        }
        return array.getArray(tags);
      },

      /**
       * Sets the tag(s) of the datasource speciifed by its id.
       */
      setTags: function(id, tags) {
        tags = set.create(tags).toArray();
        if (this.isDerived(id)) {
          dataCollection[id].glDerive.tags = tags;
        }
        dataCollection[id].tags = tags;
      },


      /**
       * Adds tag(s) to a datasource by id.
       * If tag is already present, no operation is performed.
       */
      addTags: function(id, tags) {
        var tagSet = set.create(this.getTags(id));
        tagSet.add(tags);
        this.setTags(id, tagSet.toArray());
      },

      /**
       * Removes tag(s) from a datasource by id.
       * If tag isn't present, no operation is performed.
       */
      removeTags: function(id, tags) {
        var tagSet = set.create(this.getTags(id));
        tagSet.remove(tags);
        this.setTags(id, tagSet.toArray());
      },

     /**
       * Checks if tag(s) belong to a datasource by id.
       */
      hasTags: function(id, tags) {
        return array.getArray(tags).every(function(tag) {
          return array.contains(this.getTags(id), tag);
        }, this);
      },

      /**
       * Togggles the presence the of the given tags with the
       * datasource with the associated id.
       * In other words,
       * Adds a tag if it isn't present.
       * Removes a tag if it is present.
       * @param  {@Object} scope/rootid
       */
       //todo: functional approach for scoping
       //XXX: optimize update derivations
      toggleTags: function(id, tags, scope) {
        var tagSet, scopeFn;
        tagSet = set.create(this.getTags(id));
        scopeFn = getScopeFn(scope);
        tags = array.getArray(tags);
        tagSet.toggle(tags);
        this.setTags(id, tagSet.toArray());
        this.updateDerivations();
        globalPubsub.pub(scopeFn('data-toggle'), id);
      },

      /**
       * Get data source by id.
       */
      get: function(id) {
        if (obj.get(dataCollection, id)) {
          if (this.isDerived(id)) {
            return dataCollection[id].glDerivation ||
                   'gl-error-not-computed';
          }
          return dataCollection[id];
        }
        if (arguments.length === 0) {
          return Object.keys(dataCollection).map(function(k) {
            var data = dataCollection[k];
            return data.glDerivation || data;
          });
        }
        return null;
      },

      /**
       * Accepts the following string of comma-delimited:
       * ids
       * wildcards (* for all non-derived sources, + for all sources)
       */
      select: function(sources) {
        var dataSelection = selection.create(),
            dataList = [], ids = [];
        resolveSources(sources, this).forEach(function(s) {
          ids = ids.concat(s);
        });
        ids.forEach(function(id) {
          id = id.trim();
          if(dataCollection[id]) {
            dataList.push(this.get(id));
          } else {
            Object.keys(dataCollection).forEach(function(k) {
              if(this.hasTags(k, id)) {
                dataList.push(this.get(k));
              }
            }, this);
          }
        }, this);
        dataSelection.add(dataList);
        return dataSelection;
      },

      /**
       * Checks whether dataCollection is empty
       * @return {Boolean}
       */
      isEmpty: function(optSel) {
        if (optSel) {
          return this.select(optSel).length() === 0;
        }
        return Object.keys(dataCollection).length === 0;
      }
    };
  }

  return {

    /**
     * Creates a new collection.
     */
    create: function() {
      return collection();
    },

    /**
     * Checks if a data source matches a sources selector.
     *
     * @param {Object} datasource A datasource config object.
     * @param {Array} sources An array of data ids or tags to check.
     * @return {Boolean}
     */
    isInSources: function(datasource, sources) {
      var tags = array.getArray(datasource.tags);
      tags.push(datasource.id);
      return array.containsAny(sources, tags);
    }

  };

});
