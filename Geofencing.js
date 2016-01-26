var _sheet;
var _info; 
var _data;
var _map;

function PluginMain(sheet) {
  _sheet = sheet;

  trcGetSheetInfo(sheet, function(info) {
    _info = info;

    trcGetSheetContents(_sheet, function(data) {
      _data = data;
      _map  = initMap(_info.Latitute, _info.Longitude);

      addMarkers();
      initDrawingManager(_map); // adds drawing capability to map

      trcGetChildSheetInfo(_sheet, function(summary) {
        initWalklist(summary.Children);
      });
    });
  });
}

// loops through sheet records, passing their lat/lng 
// to 'addMarker' function
function addMarkers() {
  var records = _info.CountRecords;

  for (var i = 0; i < records; i++) {
    var recId = _data["RecId"][i];
    var lat   = _data["Lat"][i];
    var lng   = _data["Long"][i];
    
    addMarker(lat, lng);
  }
}

// Adds existing walklists to sidebar
// Connects map markers via polyline that are in same walklist
function initWalklist(children) {
  for(var i=0; i < children.length; i++) {
    var child   = children[i];
    var name    = child.ChildInfo.Name;
    var numRec  = child.ChildInfo.CountRecords;
    var sheetId = child.SheetId;
    var color   = randomColor();

    appendWalklist(name, numRec, color);
    getChildCoords(child.SheetId, numRec, color);
  }
}

// creates polyline connecting map markers
function addPolyLine(coords, color) {
  var path = new google.maps.Polyline({
    path: coords,
    geodesic: true,
    strokeColor: color,
    strokeOpacity: 1.0,
    strokeWeight: 40
  });

  path.setMap(_map);
}

// get coordiates (latitude, longitude) from child records
function getChildCoords(sheetId, numRec, color) {
  var childSheetRef = trcGetSheetRef(sheetId, _sheet);

  trcGetSheetContents(childSheetRef, function(data) {
    var coords = [];

    for(var i=0; i < numRec; i++) {
      var lat    = data["Lat"][i];
      var lng    = data["Long"][i];
      var latlng = new google.maps.LatLng(lat, lng);
      coords.push(latlng);
    }

    addPolyLine(coords, color);
  });
}

// adds map marker based on last/lng
function addMarker(lat, lng) {
  var latLng = new google.maps.LatLng(lat, lng);
  var marker = new google.maps.Marker({
    position: latLng,
    map: _map
  });
}

// create walklist
function createWalklist(name, ids) {
  trcCreateChildSheet(_sheet, name, ids, function(childSheetRef) {
    var color = randomColor();

    appendWalklist(name, ids.length, color);
    getChildCoords(childSheetRef.SheetId, ids.length, color);
  });
}

// add walklist to sidebar
function appendWalklist(name, count, color) {
  $('#walklists').append("<tr style='border-left: 10px solid "+color+"'><td>"+name+"</td><td>"+count+"</td></tr>")
}

// Initialize Google Map
function initMap(lat, lng) {
  var coords = new google.maps.LatLng(lat, lng);

  var mapOptions = {
    zoom: 16,
    center: coords,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };

  var mapEl = document.getElementById("map");
  // need to give element height for GMap to render, so add 'map' CSS
  // class which has height rule
  mapEl.setAttribute('class', 'map'); 

  var gmap = new google.maps.Map(mapEl, mapOptions);

  return gmap;
}

// add drawing capability to map
function initDrawingManager(map) {
  var drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.POLYGON,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_CENTER,
      drawingModes: [
        google.maps.drawing.OverlayType.POLYGON
      ]
    },
    polygonOptions: {
      editable: true
    }
  });

  // add event listener for when shape is drawn
  google.maps.event.addListener(drawingManager, 'overlaycomplete', function(event) {
    var walklistName = prompt("Name of walklist");

    if (walklistName === undefined || walklistName === "") {
      alert("Walklist name can't be empty");
      event.overlay.setMap(null); // remove polygon
    } else {
      var recIds = getPolygonIds(event.overlay);

      if (recIds.length === 0) {
        alert("No records found in polygon");
        event.overlay.setMap(null); // remove polygon
      } else {
        // event listener for when shape is modified
        // google.maps.event.addListener(event.overlay.getPath(), 'set_at', function(index, obj) {
        //   alert('test');
        //    
        // });
        createWalklist(walklistName, recIds);
      }
    }
  });

  drawingManager.setMap(map);
}

function getPolygonIds(polygon) {
  var ids     = [];
  var numRows = _info.CountRecords;

  for (var i = 0; i < numRows; i++) {
    var id  = _data["RecId"][i];
    var lat = _data["Lat"][i];
    var lng = _data["Long"][i];

    if (isInsidePolygon(lat, lng, polygon)) {
      ids.push(id);
    }
  }

  return ids;
}

// returns true if lat/lng coordinates are inside drawn polygon,
// false otherwise
function isInsidePolygon(lat, lng, poly) {
  var coords = new google.maps.LatLng(lat, lng);

  var result = google.maps.geometry.poly.containsLocation(coords, poly);
  return result;
}

