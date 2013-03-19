/**
 * @fileOverview
 * Layout manager.
 */
define([
  'layout/layouts',
  'core/array'
],
function (layouts, array) {
  'use strict';

  function calculateDim(splits, length) {
    return splits.map(function(split) {
      return (parseInt(split, 10)/100) * length;
    });
  }

  function percent(number, percentage) {
    percentage = percentage || 1;
    return parseInt(number, 10) * (percentage/100);
  }

  function getPaddingContainer(node, nodeInfo) {
    var child, paddingLeft, paddingRight, paddingTop,
        paddingBottom, percentWidth, percentHeight;
    if (nodeInfo.padding) {
      paddingLeft = paddingRight = paddingTop =
        paddingBottom = nodeInfo.padding;
    } else {
      paddingLeft = paddingRight = paddingTop =
        paddingBottom = 0;
    }
    paddingLeft += nodeInfo.paddingLeft || 0;
    paddingRight += nodeInfo.paddingRight || 0;
    paddingTop += nodeInfo.paddingTop || 0;
    paddingBottom += nodeInfo.paddingBottom || 0;

    if (paddingLeft === 0 && paddingRight === 0 &&
          paddingTop === 0 && paddingBottom === 0) {
      return node;
    }

    child = node.append('g');
    child.attr({
      'gl-padding': nodeInfo.padding,
      'gl-padding-left': nodeInfo.paddingLeft,
      'gl-padding-right': nodeInfo.paddingRight,
      'gl-padding-top': nodeInfo.paddingTop,
      'gl-padding-bottom': nodeInfo.paddingBottom
    });
    percentWidth = percent(node.width());
    percentHeight = percent(node.height());
    child.size(
      percent(node.width(), 100 - (paddingLeft + paddingRight)),
      percent(node.height(), 100 - (paddingTop + paddingBottom)));
    child.position('top-left',
      percentWidth * paddingLeft, percentHeight * paddingTop);
    return child;
  }

  /**
   * Computes border parameters required to set borders
   * @param  {Object} nodeInfo
   * @return {Object}
   *  {style: borderStyle, color: borderColor, width: [t, r, b, l]}
   */
  function getBorderParams(nodeInfo) {
    var borderParams = {},
      strokeWidth,
      width,
      hasBorder;

    width = [0, 0, 0, 0];
    hasBorder = false;

    if (nodeInfo.border) {
      strokeWidth = parseInt(nodeInfo.border, 10);
      width = [strokeWidth, strokeWidth, strokeWidth, strokeWidth];
      hasBorder = true;
    }
    if (nodeInfo.borderTop) {
      width[0] = parseInt(nodeInfo.borderTop, 10);
      hasBorder = true;
    }
    if (nodeInfo.borderRight) {
      width[1] = parseInt(nodeInfo.borderRight, 10);
      hasBorder = true;
    }
    if (nodeInfo.borderBottom) {
      width[2] = parseInt(nodeInfo.borderBottom, 10);
      hasBorder = true;
    }
    if (nodeInfo.borderLeft) {
      width[3] = parseInt(nodeInfo.borderLeft, 10);
      hasBorder = true;
    }

    borderParams = {
      color: nodeInfo.borderColor || '#999',
      style: nodeInfo.borderStyle || 'solid',
      width: width,
      hasBorder: hasBorder
    };

    return borderParams;

  }

  function applyLayout(node) {
    if (node.classed('gl-vgroup')) {
      node.layout({type: 'vertical'});
    } else if (node.classed('gl-hgroup')) {
      node.layout({type: 'horizontal'});
    }
  }

  return {

    /**
     * Renders the layout, which is either specified by its string id,
     * or the layout object.
     * Takes the root svg element, width and height.
     */
    setLayout: function(layout, root, width, height) {
      var layoutConfig, node, dim, borderParams;

      layoutConfig = (typeof layout === 'string') ?
        layouts.getLayout(layout) :
        layout;

      array.getArray(layoutConfig).forEach(function(nodeInfo) {
        node = root.append('g');
        node.size(width, height);
        borderParams = getBorderParams(nodeInfo);
        if (borderParams.hasBorder) {
          node.border(
            borderParams.style,
            borderParams.color,
            borderParams.width
          );
        }
        if (nodeInfo.backgroundColor) {
          node.backgroundColor(nodeInfo.backgroundColor);
        }
        node = getPaddingContainer(node, nodeInfo);
        node.attr({
          'class': nodeInfo['class'],
          'gl-split': nodeInfo.split
        });
        if (node.classed('gl-vgroup')) {
          dim = calculateDim(nodeInfo.split, height);
          dim = dim.map(function(d) {
            return [width, d];
          });
        } else if (node.classed('gl-hgroup')) {
          dim = calculateDim(nodeInfo.split, width);
          dim = dim.map(function(d) {
            return [d, height];
          });
        }
        array.getArray(nodeInfo.children).forEach(function(child, i) {
          if (dim) {
            this.setLayout(child, node, dim[i][0], dim[i][1]);
          } else {
            this.setLayout(child, node, node.width(), node.height());
          }
        }, this);
        applyLayout(node);
      }, this);

    }

  };
});
