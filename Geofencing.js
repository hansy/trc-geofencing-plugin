var _sheet;
var _info; // save sheet info for renderSheet func use 
var _data; // raw sheet data to be reused

function PluginMain(sheet) {
  $('#main').empty();

  _sheet = sheet;

  trcGetSheetInfo(sheet, function (info) {
    _info = info;

    updateNumResults(info.CountRecords);

    // Get sheet Latitude/Longitude to initialize GMap
    var lat  = info.Latitute;
    var lng  = info.Longitude;
    var gmap = initMap(lat, lng);

    initDrawingManager(gmap); // adds drawing capability to map

    trcGetSheetContents(sheet, function (data) {
      _data = data;
      renderSheet(info, data);
    });
  });
}

// Initialize Google Map
function initMap(lat, lng) {
  var coords = new google.maps.LatLng(lat, lng);

  var mapOptions = {
    zoom: 13,
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

function initDrawingManager(map) {
  var drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.POLYGON,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_CENTER,
      drawingModes: [
        google.maps.drawing.OverlayType.POLYGON
      ]
    },
  });

  // add event listener for when shape is drawn
  google.maps.event.addListener(drawingManager, 'overlaycomplete', function(event) {
    $('#main').empty();
    updateSheet(_info, _data, event.overlay);
  });

  drawingManager.setMap(map);
}

function updateSheet(info, data, poly) {
  var hits = 0; // track number of rows inside polygon

  var numRows = info.CountRecords;
  {
    var t = $('<thead>').append($('<tr>'));
    for (var i = 0; i < info.Columns.length; i++) {
      var columnInfo = info.Columns[i];
      var displayName = columnInfo.DisplayName;
      var tCell1 = $('<td>').text(displayName);
      t = t.append(tCell1);
    }
    $('#main').append(t);
  }
  for (var iRow = 0; iRow < numRows; iRow++) {
    var recId = data["RecId"][iRow];
    var lat   = data["Lat"][iRow];
    var lng   = data["Long"][iRow];

    if (isInsidePolygon(lat, lng, poly)) {
      hits++;

      var t = $('<tr>');
      for (var i = 0; i < info.Columns.length; i++) {
        var columnInfo = info.Columns[i];
        var columnData = data[columnInfo.Name];

        var value = columnData[iRow];
        var tcell = getCellContents(columnInfo, value, recId);
        t = t.append(tcell);
      }
      $('#main').append(t);
    }
  }

  updateNumResults(hits);
}

// returns true if lat/lng coordinates are inside drawn polygon,
// false otherwise
function isInsidePolygon(lat, lng, poly) {
  var coords = new google.maps.LatLng(lat, lng);

  var result = google.maps.geometry.poly.containsLocation(coords, poly);
  return result;
}

// shows number of returned rows
function updateNumResults(num) {
  $('#numRows').html(num);
}
