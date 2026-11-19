import { escapeHtml } from '../lib/safeHtml';
import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { AnalysisResult, Language } from '../types';
import { t } from '../i18n';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
    result: AnalysisResult;
    lang: Language;
}

// Known archaeological regions → approximate coordinates
const REGION_COORDS: Record<string, [number, number]> = {
    // Turkey
    'istanbul': [41.0082, 28.9784],
    'ankara': [39.9334, 32.8597],
    'izmir': [38.4192, 27.1287],
    'efes': [37.9411, 27.3419],
    'ephesus': [37.9411, 27.3419],
    'troya': [39.9574, 26.2389],
    'troy': [39.9574, 26.2389],
    'kapadokya': [38.6431, 34.8289],
    'cappadocia': [38.6431, 34.8289],
    'hattuşa': [40.0194, 34.6142],
    'hattusa': [40.0194, 34.6142],
    'göbeklitepe': [37.2231, 38.9225],
    'göbekli tepe': [37.2231, 38.9225],
    'gobekli tepe': [37.2231, 38.9225],
    'anadolu': [39.0, 35.0],
    'anatolia': [39.0, 35.0],
    'turkey': [39.0, 35.0],
    'türkiye': [39.0, 35.0],
    'bergama': [39.1217, 27.1831],
    'pergamon': [39.1217, 27.1831],
    'antakya': [36.2025, 36.1597],
    'antioch': [36.2025, 36.1597],
    'side': [36.7672, 31.3906],
    'perge': [36.9608, 30.8536],
    'aspendos': [36.9389, 31.1714],
    'didim': [37.3839, 27.2694],
    'milet': [37.5306, 27.2783],
    'miletus': [37.5306, 27.2783],
    'bodrum': [37.0349, 27.4305],
    'halicarnassus': [37.0349, 27.4305],
    'afrodisias': [37.7089, 28.7269],
    'aphrodisias': [37.7089, 28.7269],
    'zeugma': [37.0531, 37.8658],
    'sardis': [38.4750, 28.0361],
    'sardes': [38.4750, 28.0361],
    'hierapolis': [37.9261, 29.1264],
    'pamukkale': [37.9261, 29.1264],
    'myra': [36.2594, 29.9842],
    'xanthos': [36.3550, 29.3172],
    'lycia': [36.5, 29.5],
    'likya': [36.5, 29.5],
    // Greece
    'atina': [37.9838, 23.7275],
    'athens': [37.9838, 23.7275],
    'yunanistan': [39.0742, 21.8243],
    'greece': [39.0742, 21.8243],
    'greek': [37.9838, 23.7275],
    'yunan': [37.9838, 23.7275],
    'helen': [37.9838, 23.7275],
    'sparta': [37.0742, 22.4295],
    'olympia': [37.6386, 21.6300],
    'delphi': [38.4824, 22.5010],
    'mycenae': [37.7306, 22.7567],
    'knossos': [35.2983, 25.1625],
    'crete': [35.2401, 24.8093],
    'girit': [35.2401, 24.8093],
    'corinth': [37.9059, 22.8796],
    'korint': [37.9059, 22.8796],
    'thessaloniki': [40.6401, 22.9444],
    'selanik': [40.6401, 22.9444],
    'rhodes': [36.4349, 28.2176],
    'rodos': [36.4349, 28.2176],
    'delos': [37.3963, 25.2674],
    // Egypt
    'mısır': [26.8206, 30.8025],
    'egypt': [26.8206, 30.8025],
    'egyptian': [26.8206, 30.8025],
    'kahire': [30.0444, 31.2357],
    'cairo': [30.0444, 31.2357],
    'luxor': [25.6872, 32.6396],
    'giza': [29.9792, 31.1342],
    'thebes': [25.7186, 32.6108],
    'alexandria': [31.2001, 29.9187],
    'iskenderiye': [31.2001, 29.9187],
    'karnak': [25.7188, 32.6573],
    'abu simbel': [22.3372, 31.6258],
    'valley of the kings': [25.7402, 32.6014],
    'firavun': [29.9792, 31.1342],
    'pharaoh': [29.9792, 31.1342],
    'memphis': [29.8484, 31.2550],
    'saqqara': [29.8713, 31.2165],
    // Mesopotamia
    'mezopotamya': [33.0, 44.0],
    'mesopotamia': [33.0, 44.0],
    'babil': [32.5355, 44.4275],
    'babylon': [32.5355, 44.4275],
    'babylonian': [32.5355, 44.4275],
    'sümer': [31.0, 46.0],
    'sumer': [31.0, 46.0],
    'sumerian': [31.0, 46.0],
    'ur': [30.9628, 46.1031],
    'ninova': [36.3600, 43.1500],
    'nineveh': [36.3600, 43.1500],
    'assur': [35.4558, 43.2594],
    'assyria': [35.4558, 43.2594],
    'assyrian': [35.4558, 43.2594],
    'iraq': [33.3, 44.4],
    'irak': [33.3, 44.4],
    // Rome
    'roma': [41.9028, 12.4964],
    'rome': [41.9028, 12.4964],
    'roman': [41.9028, 12.4964],
    'pompeii': [40.7509, 14.4869],
    'pompei': [40.7509, 14.4869],
    'herculaneum': [40.8059, 14.3474],
    'italy': [41.9028, 12.4964],
    'italya': [41.9028, 12.4964],
    'latin': [41.9028, 12.4964],
    'ostia': [41.7556, 12.2914],
    // Byzantine
    'bizans': [41.0082, 28.9784],
    'byzantine': [41.0082, 28.9784],
    'byzantium': [41.0082, 28.9784],
    'konstantinopolis': [41.0082, 28.9784],
    'constantinople': [41.0082, 28.9784],
    // Ottoman
    'osmanlı': [41.0082, 28.9784],
    'ottoman': [41.0082, 28.9784],
    'topkapı': [41.0115, 28.9833],
    'topkapi': [41.0115, 28.9833],
    // Persia
    'persepolis': [29.9352, 52.8914],
    'iran': [32.4279, 53.6880],
    'pers': [32.4279, 53.6880],
    'persia': [32.4279, 53.6880],
    'persian': [32.4279, 53.6880],
    'susa': [32.1897, 48.2582],
    'pasargadae': [30.1928, 53.1656],
    // China
    'çin': [35.8617, 104.1954],
    'china': [35.8617, 104.1954],
    'chinese': [35.8617, 104.1954],
    'xian': [34.3416, 108.9398],
    "xi'an": [34.3416, 108.9398],
    'beijing': [39.9042, 116.4074],
    'pekin': [39.9042, 116.4074],
    // India
    'hindistan': [20.5937, 78.9629],
    'india': [20.5937, 78.9629],
    'indian': [20.5937, 78.9629],
    'mohenjo-daro': [27.3242, 68.1364],
    'harappa': [30.6312, 72.8656],
    // Phoenicia
    'fenike': [33.9, 35.5],
    'phoenicia': [33.9, 35.5],
    'phoenician': [33.9, 35.5],
    'carthage': [36.8528, 10.3234],
    'kartaca': [36.8528, 10.3234],
    'tyre': [33.2705, 35.1965],
    'sidon': [33.5571, 35.3729],
    // Mesoamerica
    'maya': [17.2, -89.6],
    'aztec': [19.4326, -99.1332],
    'aztek': [19.4326, -99.1332],
    'inca': [-13.1631, -72.5450],
    'inka': [-13.1631, -72.5450],
    'teotihuacan': [19.6925, -98.8438],
    'machu picchu': [-13.1631, -72.5450],
    // Hittite
    'hitit': [40.0194, 34.6142],
    'hittite': [40.0194, 34.6142],
    // Urartu
    'urartu': [38.5, 43.4],
    'van': [38.5018, 43.3837],
    // Lydia
    'lidya': [38.4750, 28.0361],
    'lydia': [38.4750, 28.0361],
    // Phrygia
    'frigya': [39.0, 30.5],
    'phrygia': [39.0, 30.5],
    'gordion': [39.6500, 31.9833],
    // General
    'akdeniz': [35.0, 18.0],
    'mediterranean': [35.0, 18.0],
    'ortadoğu': [29.0, 41.0],
    'middle east': [29.0, 41.0],
    'kuzey afrika': [28.0, 13.0],
    'north africa': [28.0, 13.0],
    'levant': [33.0, 36.0],
    'central asia': [42.0, 65.0],
    'orta asya': [42.0, 65.0],
    'japonya': [36.2048, 138.2529],
    'korea': [35.9078, 127.7669],
    'kore': [35.9078, 127.7669],
    'angkor': [13.4125, 103.8670],
    'cambodia': [12.5657, 104.9910],
    // South America / Pre-Columbian
    'tiwanaku': [-16.555, -68.673],
    'nazca': [-14.716, -75.131],
    'caral': [-10.892, -77.611],
    'chichen itza': [20.684, -88.567],
    'tikal': [17.222, -89.623],
    'palenque': [17.484, -92.046],
    'tenochtitlan': [19.432, -99.133],
    // Near East / Levant expansion
    'petra': [30.328, 35.444],
    'jericho': [31.856, 35.463],
    'erika': [31.856, 35.463],
    'damascus': [33.513, 36.291],
    'aleppo': [36.201, 37.161],
    'çatalhöyük': [37.667, 32.828],
    'catal hoyuk': [37.667, 32.828],
    'uruk': [31.322, 45.635],
    'lagash': [31.424, 46.155],
    // Africa expansion
    'axum': [14.124, 38.718],
    'meroe': [16.936, 33.743],
    'great zimbabwe': [-20.267, 30.933],
    'leptis magna': [32.637, 14.288],
    'timbuktu': [16.775, -3.007],
    // Europe expansion
    'stonehenge': [51.178, -1.826],
    'skara brae': [59.048, -3.342],
    'newgrange': [53.694, -6.446],
    'lascaux': [45.053, 1.171],
    'altamira': [43.376, -4.122],
};

function findCoordinates(result: AnalysisResult): [number, number] | null {
    // 1. First try CURRENT location (Museum where it is actively displayed)
    if (result.current_location?.coordinates && Array.isArray(result.current_location.coordinates) && result.current_location.coordinates.length === 2) {
        const [lat, lng] = result.current_location.coordinates;
        if (typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0)) {
            return [lat, lng];
        }
    }

    // 2. Then try historical origin coordinates
    if (result.coordinates && Array.isArray(result.coordinates) && result.coordinates.length === 2) {
        const [lat, lng] = result.coordinates;
        if (typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0)) {
            return [lat, lng];
        }
    }

    // 2. Fallback: match region/culture against known coordinates
    const searchTerms = `${result.origin?.region || ''} ${result.origin?.culture || ''} ${result.title || ''}`.toLowerCase();
    for (const [key, coords] of Object.entries(REGION_COORDS)) {
        if (searchTerms.includes(key)) {
            return coords;
        }
    }

    return null;
}

export const MapView: React.FC<MapViewProps> = React.memo(({ result, lang }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);

    const isTr = lang === 'tr';
    const region = result.origin?.region || '';
    const culture = result.origin?.culture || '';
    const coords = findCoordinates(result);

    useEffect(() => {
        if (!coords || !mapRef.current) return;

        // Clean up previous map
        if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }

        const map = L.map(mapRef.current, {
            zoomControl: true,
            scrollWheelZoom: true,
        }).setView(coords, 6);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Custom icon
        const icon = L.divIcon({
            html: `<div style="background:#1c1917;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            className: '',
        });

        const popupTitle = result.current_location?.museum || result.title;
        const popupSubtitle = result.current_location
            ? `${result.current_location.city}, ${result.current_location.country}`
            : `${region} • ${culture}`;
        const contextText = result.current_location?.museum
            ? (isTr ? 'Güncel Konum' : 'Current Location')
            : (isTr ? 'Keşif Yeri' : 'Discovery Site');

        L.marker(coords, { icon }).addTo(map)
            .bindPopup(`
          <div style="font-family: serif; text-align: center; padding: 8px;">
            <strong style="font-size: 14px; display: block; margin-bottom: 4px;">${escapeHtml(popupTitle)}</strong>
            <span style="font-size: 12px; color: #666; display: block;">${escapeHtml(popupSubtitle)}</span>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee;">
               <span style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(contextText)}</span>
            </div>
          </div>
        `)
            .openPopup();

        // Subtle region circle
        L.circle(coords, {
            color: '#1c1917',
            fillColor: '#1c1917',
            fillOpacity: 0.06,
            radius: 80000,
            weight: 1,
        }).addTo(map);

        // Use ResizeObserver for robust map sizing
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });

        if (mapRef.current) {
            resizeObserver.observe(mapRef.current);
        }

        mapInstance.current = map;

        return () => {
            resizeObserver.disconnect();
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [coords?.[0], coords?.[1], region, culture, result.title, lang]);

    if (!coords) {
        return (
            <div className="bg-[var(--bg-secondary)] p-12 rounded-[2rem] border border-[var(--border-primary)] text-center animate-fade-in">
                <MapPin className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                <p className="text-stone-400 text-sm">{t('map.noLocation', lang)}</p>
                <p className="text-stone-300 text-xs mt-2">{region} • {culture}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="map-container rounded-[2rem] overflow-hidden border border-[var(--border-primary)] shadow-lg" style={{ height: '450px' }}>
                <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
            </div>
            <div className="flex items-center gap-3 px-4">
                <MapPin className="w-4 h-4 text-stone-400" />
                <span className="text-sm text-stone-500">
                    {result.current_location
                        ? `${result.current_location.museum} (${result.current_location.city})`
                        : `${region} • ${culture}`}
                </span>
                <span className="text-xs text-stone-400 ml-auto">
                    {coords[0].toFixed(4)}°, {coords[1].toFixed(4)}°
                </span>
            </div>
        </div>
    );
});
