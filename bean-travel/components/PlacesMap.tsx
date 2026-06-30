import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { resolvePlaceCoordinates } from '@/constants/cityCoords';
import { COUNTRY_COORDS, countryToPath } from '@/constants/countryPaths';
import { VisitedPlace } from '@/types';

interface Props {
  places: VisitedPlace[];
  selectedPlaceId?: string | null;
  onPlacePress?: (place: VisitedPlace) => void;
  variant?: 'full' | 'home';
}

const CATEGORY_COLORS: Record<string, string> = {
  city: '#E8825A',
  landmark: '#6BA3C4',
  restaurant: '#C9963A',
  coffee_shop: '#8B5CF6',
  hotel: '#9B8EC4',
  nature: '#7DAF8C',
  hidden_spot: '#E87A8C',
};

const CATEGORY_LABELS: Record<string, string> = {
  city: 'City',
  landmark: 'Landmark',
  restaurant: 'Restaurant',
  coffee_shop: 'Coffee Shop',
  hotel: 'Hotel',
  nature: 'Nature',
  hidden_spot: 'Hidden Spot',
};

export default function PlacesMap({ places, selectedPlaceId, onPlacePress, variant = 'full' }: Props) {
  const mapped = useMemo(() => places
    .map(resolvePlaceCoords)
    .filter((place): place is VisitedPlace & { latitude: number; longitude: number } => Boolean(place)), [places]);
  const isHomePreview = variant === 'home';

  useEffect(() => {
    if (!onPlacePress || typeof window === 'undefined') return undefined;
    const selectPlace = onPlacePress;

    function handleMessage(event: MessageEvent) {
      if (!event.data || event.data.type !== 'travel-bean-map-select') return;
      const place = mapped.find(item => item.id === event.data.placeId);
      if (place) selectPlace(place);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mapped, onPlacePress]);

  const html = useMemo(() => {
    const markerCoords = spreadMarkerCoords(mapped);
    const selectedIndex = selectedPlaceId ? mapped.findIndex(place => place.id === selectedPlaceId) : -1;
    const selectedCoords = selectedIndex >= 0 ? markerCoords[selectedIndex] : null;
    const selectedZoom = isHomePreview ? 3.25 : 4.5;
    const fitPadding = isHomePreview ? 38 : 72;
    const fallbackCountries = Object.values(COUNTRY_COORDS)
      .map(rings => `<path d="${countryToPath(rings)}" fill="#AFC8BE" stroke="#F7FBF7" stroke-width="0.42" />`)
      .join('');
    const fallbackMarkers = mapped.map((place, index) => {
      const coords = markerCoords[index];
      const x = clamp(((coords.longitude + 180) / 360) * 360, 9, 351);
      const y = clamp(((90 - coords.latitude) / 180) * 180, 9, 171);
      const active = place.id === selectedPlaceId;
      return `
        <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
          ${active ? '<circle cx="0" cy="-1" r="15.5" fill="#F26A2E" opacity="0.18" /><circle cx="0" cy="-1" r="11.5" fill="none" stroke="#FFFDF8" stroke-width="2.6" />' : ''}
          <circle cx="0" cy="0" r="${active ? '8.8' : '7.2'}" fill="#FFFFFF" opacity="${active ? '0.96' : '0.78'}" />
          <path d="M0 8C-1.8 4.8-6.2 1.4-6.2-3.5A6.2 6.2 0 0 1 6.2-3.5C6.2 1.4 1.8 4.8 0 8Z" fill="${active ? '#183F4A' : '#F26A2E'}" stroke="#FFFFFF" stroke-width="${active ? '1.7' : '1.25'}" />
          <circle cx="0" cy="-3.3" r="${active ? '2.45' : '2.1'}" fill="#FFFFFF" />
        </g>
      `;
    }).join('');
    const markersJs = mapped.map((p, index) => {
      const coords = markerCoords[index];
      const color = CATEGORY_COLORS[p.category] ?? '#E8825A';
      const label = CATEGORY_LABELS[p.category] ?? p.category;
      const safeId = JSON.stringify(p.id);
      const safeName = p.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeCountry = p.country.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeColor = color.replace('#', '');
      const active = p.id === selectedPlaceId;
      const activeClass = active ? ' is-active' : '';
      const activeLabel = active ? '<div class="bean-pin-label">Selected</div>' : '';
      const zIndexOffset = active ? 1200 : 0;
      return `
        (function() {
          var beanIcon = L.divIcon({
            className: 'bean-map-pin',
            iconSize: [72, 82],
            iconAnchor: [36, 72],
            popupAnchor: [0, -68],
            html: '<div class="bean-pin${activeClass}" style="--pin:${color};--pin-dark:#${safeColor}cc">' +
              '<div class="bean-pin-halo"></div>' +
              '${activeLabel}' +
              '<div class="bean-pin-body"><svg viewBox="0 0 64 64" aria-hidden="true">' +
              '<path d="M49.4 11.1c6.6 6.9 5.7 19.9-1.8 29.1-8.4 10.4-22.4 13.6-31.4 7.5-8.7-5.9-9.1-18.1-2.6-27.4 3.9-5.6 8.7-7.8 14.1-7.1 4.8.7 7.1 4.4 12.1 4.2 3.5-.1 5.7-2.9 9.6-6.3Z" fill="var(--pin)"/>' +
              '<path d="M19.4 42.4c8.5 4.2 20.3-.4 25.9-9.9" fill="none" stroke="white" stroke-linecap="round" stroke-width="5" opacity=".76"/>' +
              '</svg></div><div class="bean-pin-tip"></div></div>'
          });
          var marker = L.marker([${coords.latitude}, ${coords.longitude}], { icon: beanIcon, zIndexOffset: ${zIndexOffset} }).addTo(map);
          markerLookup[${safeId}] = marker;
          ${active ? 'marker.setZIndexOffset(1200); marker.bringToFront();' : ''}
          marker.bindPopup(
            '<div style="font-family:-apple-system,BlinkMacSystemFont,\\'Inter\\',sans-serif;min-width:140px">' +
            '<div style="font-size:15px;font-weight:700;color:#2D2926;margin-bottom:3px">${safeName}</div>' +
            '<div style="font-size:12px;color:#8C857F;margin-bottom:6px">${safeCountry}</div>' +
            '<div style="display:inline-block;padding:2px 8px;border-radius:20px;background:${color}20;color:${color};font-size:11px;font-weight:600">${label}</div>' +
            '</div>',
            { maxWidth: 200, className: 'bean-popup' }
          );
          marker.on('click', function() {
            window.parent.postMessage({ type: 'travel-bean-map-select', placeId: ${safeId} }, '*');
          });
        })();
      `;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; background: #D9EFF7; }
    #map, #mapFallback { position: absolute; inset: 0; height: 100vh; width: 100vw; }
    #map { z-index: 2; background: transparent; }
    #mapFallback {
      z-index: 1;
      background: linear-gradient(180deg, #D9EFF7 0%, #C7D8EC 58%, #C3D5EA 100%);
    }
    #mapFallback svg { width: 100%; height: 100%; display: block; }
    #map:before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 420;
      background:
        radial-gradient(circle at 28% 24%, rgba(255,255,255,.48), transparent 26%),
        radial-gradient(circle at 76% 72%, rgba(84,44,244,.12), transparent 24%),
        linear-gradient(180deg, rgba(255,255,255,.1), rgba(18,58,70,.08));
      mix-blend-mode: soft-light;
    }
    .leaflet-control-zoom {
      border: none !important;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 12px 26px rgba(17,19,29,.18);
    }
    .leaflet-top.leaflet-left {
      left: auto;
      right: 14px;
      top: auto;
      bottom: 24px;
    }
    .leaflet-control-zoom a {
      width: 34px !important;
      height: 34px !important;
      line-height: 34px !important;
      border: none !important;
      color: #183F4A !important;
      background: rgba(255,255,255,.92) !important;
      font-weight: 800;
      font-size: 19px;
    }
    .leaflet-tile {
      filter: saturate(1.08) contrast(1.02) brightness(1.04) hue-rotate(8deg);
    }
    .leaflet-popup-content-wrapper {
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      padding: 4px 2px;
      border: none;
    }
    .leaflet-popup-content { margin: 10px 14px; }
    .leaflet-popup-tip-container { display: none; }
    .leaflet-control-attribution { font-size: 10px; opacity: 0.6; }
    .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    .leaflet-container,
    .leaflet-pane,
    .leaflet-tile-pane {
      background: transparent !important;
    }
    .continent-label {
      color: #496B8E;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1.3px;
      line-height: 1.08;
      text-align: center;
      text-transform: uppercase;
      text-shadow: 0 1px 0 rgba(255,255,255,.96), 0 0 8px rgba(255,255,255,.9);
      pointer-events: none;
      opacity: .88;
      white-space: normal;
    }
    .bean-map-pin { background: transparent; border: none; }
    .bean-pin { position: relative; width: 72px; height: 82px; filter: drop-shadow(0 8px 10px rgba(17,19,29,.22)); }
    .bean-pin.is-active { z-index: 40; filter: drop-shadow(0 14px 18px rgba(242,106,46,.42)); }
    .bean-pin-halo {
      position: absolute;
      left: 14px;
      top: 17px;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      background: rgba(255,255,255,.4);
      transform: scale(.82);
      opacity: 0;
      transition: opacity .18s ease, transform .18s ease;
    }
    .bean-pin.is-active .bean-pin-halo {
      opacity: 1;
      transform: scale(1.52);
      box-shadow: 0 0 0 8px rgba(242,106,46,.18), 0 0 0 16px rgba(255,255,255,.38);
    }
    .bean-pin-label {
      position: absolute;
      left: 4px;
      right: 4px;
      top: 0;
      z-index: 4;
      border-radius: 999px;
      background: rgba(255,253,248,.96);
      color: #F26A2E;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .4px;
      line-height: 18px;
      text-align: center;
      text-transform: uppercase;
      box-shadow: 0 8px 18px rgba(24,63,74,.18);
    }
    .bean-pin-body {
      position: absolute;
      left: 14px;
      top: 20px;
      width: 44px;
      height: 44px;
      border: 3px solid #fff;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--pin), #24D6B7);
      display: grid;
      place-items: center;
      z-index: 2;
      transition: transform .18s ease, box-shadow .18s ease;
    }
    .bean-pin.is-active .bean-pin-body {
      border-color: #FFFDF8;
      background: linear-gradient(135deg, #183F4A, #F26A2E);
      box-shadow: 0 0 0 6px rgba(255,255,255,.78), 0 0 0 13px rgba(242,106,46,.24);
      transform: scale(1.18);
    }
    .bean-pin-body svg {
      width: 27px;
      height: 27px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,.92);
      transform: rotate(-10deg);
    }
    .bean-pin-tip {
      position: absolute;
      left: 29px;
      bottom: 14px;
      width: 15px;
      height: 15px;
      border-right: 3px solid #fff;
      border-bottom: 3px solid #fff;
      border-radius: 4px;
      background: var(--pin);
      transform: rotate(45deg);
      z-index: 1;
    }
    body.is-home-preview #mapFallback {
      background: linear-gradient(180deg, #DDF1FC 0%, #BFDFEF 100%);
    }
    body.is-home-preview .leaflet-top.leaflet-left {
      right: 12px;
      top: auto;
      bottom: 12px;
    }
    body.is-home-preview .leaflet-control-zoom {
      border-radius: 18px;
      box-shadow: 0 10px 22px rgba(24,63,74,.16);
    }
    body.is-home-preview .leaflet-control-zoom a {
      width: 34px !important;
      height: 34px !important;
      line-height: 34px !important;
      font-size: 20px;
    }
    body.is-home-preview .leaflet-control-attribution {
      display: none;
    }
    body.is-home-preview .bean-pin {
      transform: scale(.92);
      transform-origin: 50% 100%;
    }
    body.is-home-preview .leaflet-popup {
      margin-bottom: 24px;
    }
    body.is-home-preview .continent-label {
      font-size: 11px;
      letter-spacing: 1px;
      opacity: .82;
    }
  </style>
</head>
<body class="${isHomePreview ? 'is-home-preview' : ''}">
  <div id="mapFallback">
    <svg viewBox="0 0 360 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect x="0" y="0" width="360" height="180" fill="#D9EFF7" />
      <g opacity="0.72">
        <path d="M0 34H360M0 90H360M0 146H360" stroke="#FFFFFF" stroke-width="0.45" />
        <path d="M60 0V180M180 0V180M300 0V180" stroke="#FFFFFF" stroke-width="0.45" />
      </g>
      <g opacity="0.88">
        ${fallbackCountries}
      </g>
      <g opacity="0.96">
        ${fallbackMarkers}
      </g>
    </svg>
  </div>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    var worldBounds = L.latLngBounds([[-84.8, -180], [84.8, 180]]);
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: ${isHomePreview ? 'false' : 'true'},
      doubleClickZoom: true,
      preferCanvas: true,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: ${isHomePreview ? 2.25 : 2.5},
      maxBounds: worldBounds,
      maxBoundsViscosity: 1,
      worldCopyJump: false
    }).setView([24, 18], ${isHomePreview ? 2.25 : 2.75});

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors &copy; <a href="https://carto.com">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      noWrap: true,
      bounds: worldBounds
    }).addTo(map);

    var markerLookup = {};
    var selectedPlaceId = ${JSON.stringify(selectedPlaceId)};

    function focusPoint(lat, lng, zoom) {
      var desiredOffsetY = ${isHomePreview ? 18 : 54};
      var point = map.project([lat, lng], zoom);
      var center = map.unproject([point.x, point.y - desiredOffsetY], zoom);
      map.setView(center, zoom, { animate: false });
      map.panInsideBounds(worldBounds, { animate: false });
    }

    function fitAllPlaces(bounds) {
      if (bounds.length === 1) {
        focusPoint(bounds[0][0], bounds[0][1], ${selectedZoom});
        return;
      }
      map.fitBounds(bounds, {
        paddingTopLeft: [${fitPadding}, ${isHomePreview ? 54 : 96}],
        paddingBottomRight: [${fitPadding}, ${fitPadding}],
        maxZoom: ${isHomePreview ? 3.5 : 4.25},
        animate: false
      });
      map.panInsideBounds(worldBounds, { animate: false });
    }

    [
      { name: 'NORTH<br>AMERICA', lat: 48, lng: -103 },
      { name: 'SOUTH<br>AMERICA', lat: -18, lng: -60 },
      { name: 'EUROPE', lat: 51, lng: 14 },
      { name: 'AFRICA', lat: 4, lng: 21 },
      { name: 'ASIA', lat: 38, lng: 92 },
      { name: 'AUSTRALIA', lat: -25, lng: 134 },
      { name: 'OCEANIA', lat: -13, lng: 158 }
    ].forEach(function(label) {
      L.marker([label.lat, label.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'continent-label',
          html: label.name,
          iconSize: [130, 40],
          iconAnchor: [65, 20]
        })
      }).addTo(map);
    });

    ${markersJs}

    ${selectedCoords ? `
    focusPoint(${selectedCoords.latitude}, ${selectedCoords.longitude}, ${selectedZoom});
    if (markerLookup[selectedPlaceId]) {
      setTimeout(function() {
        markerLookup[selectedPlaceId].bringToFront();
      }, 120);
    }
    ` : mapped.length > 0 ? `
    var bounds = [${markerCoords.map(p => `[${p.latitude}, ${p.longitude}]`).join(',')}];
    fitAllPlaces(bounds);
    ` : ''}
  </script>
</body>
</html>`;
  }, [isHomePreview, mapped, selectedPlaceId]);

  return (
    <View style={{ flex: 1 }}>
      {React.createElement('iframe', {
        srcDoc: html,
        style: {
          flex: 1,
          border: 'none',
          width: '100%',
          height: '100%',
          minHeight: isHomePreview ? 238 : 400,
          display: 'block',
        },
        title: 'Bean Travel Map',
        sandbox: 'allow-scripts allow-same-origin',
      })}
    </View>
  );
}

function resolvePlaceCoords(place: VisitedPlace): (VisitedPlace & { latitude: number; longitude: number }) | null {
  const coords = resolvePlaceCoordinates(place);
  return coords ? { ...place, ...coords } : null;
}

function spreadMarkerCoords(places: Array<VisitedPlace & { latitude: number; longitude: number }>) {
  const groups = new Map<string, Array<{ place: VisitedPlace & { latitude: number; longitude: number }; index: number }>>();

  places.forEach((place, index) => {
    const key = `${place.latitude.toFixed(3)}:${place.longitude.toFixed(3)}`;
    const group = groups.get(key) ?? [];
    group.push({ place, index });
    groups.set(key, group);
  });

  return places.map((place, index) => {
    const key = `${place.latitude.toFixed(3)}:${place.longitude.toFixed(3)}`;
    const group = groups.get(key) ?? [];
    const groupIndex = Math.max(0, group.findIndex(item => item.index === index));
    const groupCount = group.length;
    const radius = groupCount > 1 ? Math.min(0.45, 0.16 + groupCount * 0.035) : 0;
    const angle = groupCount > 1 ? ((Math.PI * 2) / groupCount) * groupIndex - Math.PI / 2 : 0;
    const hash = hashString(`${place.id}-${place.name}-${index}`);
    const latNudge = groupCount > 1 ? Math.sin(angle) * radius : ((hash % 5) - 2) * 0.018;
    const lonNudge = groupCount > 1 ? Math.cos(angle) * radius * 1.35 : ((Math.floor(hash / 5) % 5) - 2) * 0.026;

    return {
      latitude: clamp(place.latitude + latNudge, -84, 84),
      longitude: clamp(place.longitude + lonNudge, -179, 179),
    };
  });
}

function hashString(value: string) {
  return value.split('').reduce((total, char) => ((total << 5) - total + char.charCodeAt(0)) >>> 0, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
