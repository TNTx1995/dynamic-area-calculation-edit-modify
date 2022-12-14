import Draw from 'ol/interaction/Draw';
import Map from 'ol/Map';
import Overlay from 'ol/Overlay';
import View from 'ol/View';
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style';
import {LineString, Polygon} from 'ol/geom';
import {OSM, Vector as VectorSource} from 'ol/source';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {getArea, getLength} from 'ol/sphere';
import {unByKey} from 'ol/Observable';
import { Modify, Snap} from 'ol/interaction';
import GeoJSON from 'ol/format/GeoJSON';
import {get,transform,fromLonLat} from 'ol/proj';


var geom,tooltipCoord ;
const style = new Style({
  fill: new Fill({
    color: '#eeeeee',
  }),
});

const source = new VectorSource();

const vector = new VectorLayer({
  source: source,
  style: {
    'fill-color': 'rgba(255, 255, 255, 0.2)',
    'stroke-color': '#ffcc33',
    'stroke-width': 2,
    'circle-radius': 7,
    'circle-fill-color': '#ffcc33',
  },
});

const vectorLayer = new VectorLayer({
  background: '#000000', // for background color
  source: new VectorSource({
    url: 'assets/geojson.json',
    format: new GeoJSON()
  }),
  style: function (feature) {
    const color = feature.get('COLOR') || '#90EE90';
    style.getFill().setColor(color);
    return style;
  },
});

/**
 * Currently drawn feature.
 * @type {import("../src/ol/Feature.js").default}
 */
let sketch;
let sketchForModify;

/**
 * The help tooltip element.
 * @type {HTMLElement}
 */
let helpTooltipElement;


/**
 * Overlay to show the help messages.
 * @type {Overlay}
 */
let helpTooltip;

/**
 * The measure tooltip element.
 * @type {HTMLElement}
 */
let measureTooltipElement;
let forModifyMeasureToolTipElement ;

/**
 * Overlay to show the measurement.
 * @type {Overlay}
 */
let measureTooltip;

/**
 * Message to show when the user is drawing a polygon.
 * @type {string}
 */
const continuePolygonMsg = 'Click to continue drawing the polygon';

/**
 * Message to show when the user is drawing a line.
 * @type {string}
 */
const continueLineMsg = 'Click to continue drawing the line';

/**
 * Handle pointer move.
 * @param {import("../src/ol/MapBrowserEvent").default} evt The event.
 */

const pointerMoveHandler = function (evt) {
  if (evt.dragging) {
    return;
  }
 //console.log(evt.coordinate);
  /** @type {string} */
  let helpMsg = 'Click to start drawing';
  
  if (sketch) {
    geom = sketch.getGeometry();
    if (geom instanceof Polygon) {
      helpMsg = continuePolygonMsg;
    } else if (geom instanceof LineString) {
      helpMsg = continueLineMsg;
    }
  }

  helpTooltipElement.innerHTML = helpMsg;
  helpTooltip.setPosition(evt.coordinate);

  helpTooltipElement.classList.remove('hidden');
};

const map = new Map({
  layers: [vectorLayer, vector],
  target: 'map',
  view: new View({
    center:  transform([90.19530825000014,24.988718323000086], 'EPSG:4326', 'EPSG:3857'),
    zoom: 15,
  }),
});

map.on('pointermove', pointerMoveHandler);

map.getViewport().addEventListener('mouseout', function () {
  helpTooltipElement.classList.add('hidden');
});

const typeSelect = document.getElementById('type');

let draw; // global so we can remove it later

/**
 * Format length output.
 * @param {LineString} line The line.
 * @return {string} The formatted length.
 */
const formatLength = function (line) {
  const length = getLength(line);
  let output;
  if (length > 100) {
    output = Math.round((length / 1000) * 100) / 100 + ' ' + 'km';
  } else {
    output = Math.round(length * 100) / 100 + ' ' + 'm';
  }
  return output;
};


/**
 * Format area output.
 * @param {Polygon} polygon The polygon.
 * @return {string} Formatted area.
 */
const formatArea = function (polygon) {
 
  const area = getArea(polygon);
  console.log(area);
  let output;
  if (area > 10000) {
    output = Math.round((area / 1000000) * 100) / 100 + ' ' + 'km<sup>2</sup>';
  } else {
    output = Math.round(area * 100) / 100 + ' ' + 'm<sup>2</sup>';
  }
  return output;
};


function addInteraction() {
  const type = typeSelect.value == 'area' ? 'Polygon' : 'LineString';
  draw = new Draw({
    source: source,
    type: type,
    style: new Style({
      fill: new Fill({
        color: 'rgba(255, 255, 255, 0.2)',
      }),
      stroke: new Stroke({
        color: 'rgba(0, 0, 0, 0.5)',
        lineDash: [10, 10],
        width: 2,
      }),
      image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({
          color: 'rgba(0, 0, 0, 0.7)',
        }),
        fill: new Fill({
          color: 'rgba(255, 255, 255, 0.2)',
        }),
      }),
    }),
  });

  map.addInteraction(draw);

  createMeasureTooltip();
  createHelpTooltip();

  let listener;
  draw.on('drawstart', function (evt) {
    // set sketch
    sketch = evt.feature;
    
    /** @type {import("../src/ol/coordinate.js").Coordinate|undefined} */
    tooltipCoord = evt.coordinate;
    
    listener = sketch.getGeometry().on('change', function (evt) {
      const geom = evt.target;
      //console.log(geom);
      let output;
      if (geom instanceof Polygon) {
        output = formatArea(geom);
        tooltipCoord = geom.getInteriorPoint().getCoordinates();
        
      } else if (geom instanceof LineString) {
        output = formatLength(geom);
        tooltipCoord = geom.getLastCoordinate();
      }
      measureTooltipElement.innerHTML = output;
      measureTooltip.setPosition(tooltipCoord);
    
    });
  });
  
  draw.on('drawend', function () {
    measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
    measureTooltip.setOffset([0, -7]);
    // unset sketch
    sketch = null;
    //measureTooltipElement = null; // removed for the static label of the value 
    createMeasureTooltip();
    unByKey(listener);
  });
}

/**
 * Creates a new help tooltip
 */

function createHelpTooltip() {
  if (helpTooltipElement) {
    helpTooltipElement.parentNode.removeChild(helpTooltipElement);
  }
  helpTooltipElement = document.createElement('div');
  helpTooltipElement.className = 'ol-tooltip hidden';
  helpTooltip = new Overlay({
    element: helpTooltipElement,
    offset: [15, 0],
    positioning: 'center-left',
  });
  map.addOverlay(helpTooltip);
}

/**
 * Creates a new measure tooltip
 */

function createMeasureTooltip() {
  if (measureTooltipElement) {
    measureTooltipElement.parentNode.removeChild(measureTooltipElement);
  }
  measureTooltipElement = document.createElement('div');
  measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
  measureTooltip = new Overlay({
    element: measureTooltipElement,
    offset: [0, -15],
    positioning: 'bottom-center',
    stopEvent: false,
    insertFirst: false,
  });
  map.addOverlay(measureTooltip);
}

/**
 * Let user change the geometry type.
 */
typeSelect.onchange = function () {
  map.removeInteraction(draw);
  addInteraction();
};


addInteraction();


const modify = new Modify({source: source});
map.addInteraction(modify);
// modify start and end



var modifiedOutput;
modify.on('modifystart', function (evt) {
  // set sketch
  console.log("ok working");
  console.log(geom);
      if (geom instanceof Polygon) {
        modifiedOutput = formatArea(geom);
        tooltipCoord = geom.getInteriorPoint().getCoordinates();
        
      } else if (geom instanceof LineString) {
        modifiedOutput = formatLength(geom);
        tooltipCoord = geom.getLastCoordinate();
      }
      measureTooltipElement.innerHTML = modifiedOutput;
      measureTooltip.setPosition(tooltipCoord);
});

modify.on('modifyend',function(evt){
  console.log("Okkk finished")
  console.log(measureTooltipElement);
  measureTooltipElement.setAttribute('id','dynamicInfo');
  document.getElementById('dynamicInfo').innerHTML = modifiedOutput;
 
});






  




