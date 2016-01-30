var _sheet;
var _info; 
var _data;
var _map;
var _markers; // map markers; { recId: marker }
var _polygons; //polylines/polygons; { sheetId: polygon/polyline }

function PluginMain(sheet) {
  _sheet = sheet;

  trcGetSheetInfo(sheet, function(info) {
    _info = info;

    trcGetSheetContents(_sheet, function(data) {
      _data     = data;
      _map      = initMap(_info.Latitute, _info.Longitude);
      _markers  = {};
      _polygons = {};

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
    
    addMarker(lat, lng, recId);
  }
}

// Adds existing walklists to sidebar
// Connects map markers via polyline that are in same walklist
function initWalklist(children) {
  var sheetRefs = [];

  for(var i=0; i < children.length; i++) {
    var child    = children[i];
    var name     = child.ChildInfo.Name;
    var numRec   = child.ChildInfo.CountRecords;
    var sheetId  = child.SheetId;
    var color    = randomColor();
    var sheetRef = trcGetSheetRef(sheetId, _sheet);
    sheetRefs.push(sheetRef);

    appendWalklist(name, sheetId, numRec, color);
    renderPolylines(sheetId, numRec, color);
  }
}

function addPolyline(coords, color) {
  var polyline = new google.maps.Polyline({
    path: coords,
    strokeColor: color,
    strokeWeight: 40
  });

  polyline.setMap(_map);

  return polyline;
}

// creates polylines connecting map markers
function renderPolylines(sheetId, numRec, color) {
  var childSheetRef = trcGetSheetRef(sheetId, _sheet);

  trcGetSheetContents(childSheetRef, function(data) {
    var coords = [];

    // get coordiates (latitude, longitude) from child records
    for(var i=0; i < numRec; i++) {
      var lat    = data["Lat"][i];
      var lng    = data["Long"][i];
      var latlng = new google.maps.LatLng(lat, lng);
      coords.push(latlng);
    }

    updateMarkersWithSheetId(data["RecId"], sheetId)
    polyline = addPolyline(coords, color, sheetId);
    globallyAddPolygon(polyline, sheetId);
  });
}

// adds map marker based on last/lng
function addMarker(lat, lng, recId) {
  var latLng = new google.maps.LatLng(lat, lng);
  var marker = new google.maps.Marker({
    position: latLng,
    map: _map,
    id: recId,
    sheetId: ""
  });

  _markers[recId] = marker;
}

// event listeners for when polygon shape is modified
function addPolygonResizeEvents(polygon, sheetId) {
  google.maps.event.addListener(polygon.getPath(), 'set_at', function() {
    updateWalklist(getPolygonIds(polygon), sheetId);
  });

  google.maps.event.addListener(polygon.getPath(), 'insert_at', function () {
    updateWalklist(getPolygonIds(polygon), sheetId);
  });
}

// add child sheet id to markers with lat/lng inside walklist
function updateMarkersWithSheetId(ids, sheetId) {
  var total = ids.length;

  for (var i = 0; i < total; i++) {
    var id = ids[i];
    _markers[id].sheetId = sheetId;
  }
}

function createWalklist(name, ids, polygon) {
  trcCreateChildSheet(_sheet, name, ids, function(childSheetRef) {
    var color   = randomColor();
    var sheetId = childSheetRef.SheetId;

    addPolygonResizeEvents(polygon, sheetId);
    fillPolygon(polygon, color);
    globallyAddPolygon(polygon, sheetId);
    appendWalklist(name, sheetId, ids.length, color);
    updateMarkersWithSheetId(ids, sheetId);
  });
}

// adds polygon/polyline to global var _polygons
function globallyAddPolygon(polygon, sheetId) {
  _polygons[sheetId] = polygon;
}

function fillPolygon(polygon, color) {
  polygon.setOptions({ 
    fillColor: color,
    fillOpacity: 1 
  });
}

function updateWalklist(ids, sheetId) {
  trcPatchChildSheetRecIds(_sheet, sheetId, ids, function() {
    updateRecordNum(sheetId, ids.length);
  });
}

// update the number of records within a drawn polygon
function updateRecordNum(sheetId, count) {
  var td = $("#"+sheetId+" td.record-count");
  td.html(count);
}

// get color of polyline associated with walklist
// returns color in hexadecimal
function getColor(sheetId) {
  var tr    = $("#"+sheetId);
  var style = tr.attr('style'); // e.g. border-left: 10px solid #FFF
  var color = style.match(/#\w+/);

  return color;
}

// add walklist to sidebar
function appendWalklist(name, sheetId, count, color) {
  var tr = document.createElement('tr');
  tr.setAttribute('style', 'border-left: 10px solid ' + color);
  tr.setAttribute('id', sheetId);

  // add name column
  var tdName = document.createElement('td');
  tdName.innerHTML = name;
  tr.appendChild(tdName);

  // add record count column
  var tdCount = document.createElement('td');
  tdCount.innerHTML = count;
  tdCount.setAttribute('class', 'record-count');
  tr.appendChild(tdCount);

  // add assigned checkbox column
  var tdCheckbox = document.createElement('td');
  var checkbox   = document.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  checkbox.onclick = assignedCheckboxClickFx(sheetId);
  tdCheckbox.appendChild(checkbox);
  tr.appendChild(tdCheckbox);

  // add delete column
  var tdDelete = document.createElement('td');
  tdDelete.innerHTML = "x";
  tdDelete.setAttribute('class', 'delete-walklist-btn');
  tdDelete.onclick = deleteWalklistClickFx(sheetId);
  tr.appendChild(tdDelete);

  var walklistsEl = document.getElementById('walklists');
  var tbody       = walklistsEl.getElementsByTagName('tbody')[0];

  tbody.appendChild(tr);

  // $('#walklists').append("<tr style='border-left: 10px solid "+color+"' id='"+sheetId+"'><td>"+name+"</td><td>"+count+"</td><td><input type='checkbox'></td></tr>")
}

// function to be returned in the event a checkbox is clicked
function assignedCheckboxClickFx(sheetId) {
  return function(event) {
    if (this.checked) {
      setMarkersOpacity(sheetId, 0.2);
      setPolygonOpacity(sheetId, 0.2);
    } else {
      setMarkersOpacity(sheetId, 1);
      setPolygonOpacity(sheetId, 1);
    }
  }
}

// function to be returned when delete 'x' is clicked
function deleteWalklistClickFx(sheetId) {
  return function(event) {
    var remove = confirm("Do you wish to delete this walklist?");

    if (remove) {
      trcDeleteChildSheet(_sheet, sheetId, function() {
        removeWalklist(sheetId);
        removeGlobalPolygon(sheetId);
        removeMarkerSheetId(sheetId);
      });
    }
  }
}

// remove polygon/polyline from global var _polygons
function removeGlobalPolygon(sheetId) {
  var polygon = _polygons[sheetId];
  polygon.setMap(null);
  delete _polygons[sheetId];
}

// remove walklist from sidebar
function removeWalklist(sheetId) {
  var tr = document.getElementById(sheetId);
  tr.parentNode.removeChild(tr);
}

// unassign marker from child sheet
function removeMarkerSheetId(sheetId) {
  for (id in _markers) {
    var marker = _markers[id];
    if (marker.sheetId === sheetId) {
      marker.sheetId = "";
    }
  }
}

function setMarkersOpacity(sheetId, opacity) {
  for (id in _markers) {
    var marker = _markers[id];
    if (marker.sheetId === sheetId) {
      marker.setOpacity(opacity);
    }
  }
}

function setPolygonOpacity(sheetId, opacity) {
  var polygon = _polygons[sheetId];
  polygon.setOptions({ strokeOpacity: opacity });
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
    var polygon = event.overlay;
    var recIds  = getPolygonIds(polygon);

    if (recIds.length === 0) {
        alert("No records found in polygon");
        event.overlay.setMap(null); // remove polygon
    } else {
      var walklistName = prompt("Name of walklist");

      if (walklistName === null) {
        event.overlay.setMap(null); // remove polygon
      } else if (walklistName === "") {
        alert("Walklist name can't be empty");
        event.overlay.setMap(null);
      } else {
        createWalklist(walklistName, recIds, polygon); 
      }
    }
  });

  drawingManager.setMap(map);
}

// return rec ids within a polygon
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