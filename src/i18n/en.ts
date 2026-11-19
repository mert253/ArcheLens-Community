import { Translations } from '../types';

export const en: Translations = {
    // Navbar
    'nav.title': 'ARCHE LENS',
    'nav.subtitle': 'Open tools for cultural heritage',
    'nav.howItWorks': 'How It Works?',
    'nav.newAnalysis': 'New Analysis',
    'nav.history': 'History',
    'nav.language': 'Language',

    // Upload
    'upload.heading': 'Decode',
    'upload.headingHighlight': 'the Past',
    'upload.description': 'powered archaeological analysis and structural digital restoration platform.',
    'upload.aiEngine': 'Google Gemini AI & ArcheLens Vision',
    'upload.button': 'Upload Artifact',
    'upload.formats': 'JPG • PNG • WEBP',
    'upload.dragDrop': 'Drag & drop image here',
    'upload.orUrl': 'or analyze by URL',
    'upload.urlPlaceholder': 'Paste image URL...',
    'upload.urlAnalyze': 'Analyze',
    'upload.camera': 'Use Camera',

    // Analysis
    'analysis.report': 'Analysis Report',
    'analysis.confidence': 'Confidence Score',
    'analysis.overview': 'Overview',
    'analysis.academic': 'Academic & Epigraphy',
    'analysis.technical': 'Technical & Condition',
    'analysis.map': 'Map',
    'analysis.timeline': 'Timeline',
    'analysis.chat': 'Chat',
    'analysis.description': 'Artifact Analysis',
    'analysis.sources': 'Academic Sources (Google Search)',
    'analysis.funFact': 'Did You Know?',
    'analysis.curatorNote': 'Curator\'s Note',
    'analysis.dateRange': 'Date Range',
    'analysis.period': 'Period',
    'analysis.iconography': 'Iconography & Symbolism',
    'analysis.inscription': 'Ancient Inscription Analysis',
    'analysis.originalText': 'Original Text',
    'analysis.translation': 'English Translation',
    'analysis.academicNote': 'Academic Commentary',
    'analysis.techSpecs': 'Technical Specifications',
    'analysis.material': 'Material',
    'analysis.technique': 'Technique',
    'analysis.dimensions': 'Dimensions',
    'analysis.condition': 'Condition Report',
    'analysis.historicalContext': 'Historical Context',
    'analysis.culturalSignificance': 'Cultural Significance',
    'analysis.symbolism': 'Symbolism',
    'analysis.similarArtifacts': 'Similar Artifacts',
    'analysis.share': 'Share',
    'analysis.museum': 'Museum',

    // Restoration
    'restore.start': 'Start Restoration',
    'restore.redo': 'Re-process',
    'restore.compare': 'Compare',
    'restore.download': 'Download Image',
    'restore.mode': 'Restoration Mode',
    'restore.auto': 'CONTEXTUAL REPAIR',
    'restore.manual': 'MANUAL',
    'restore.autoDesc': 'AI completes broken pieces and ensures color accuracy by removing unwanted color casts, revealing the original tones of the artifact.',
    'restore.manualPlaceholder': 'E.g.: Complete the broken handle with gold plating...',
    'restore.manualHint': 'Provide detailed instructions.',
    'restore.original': 'ORIGINAL STATE',
    'restore.restoring': 'Restoration',
    'restore.engine': 'Nano Banana Pro Engine',
    'restore.restoringDesc': 'Completing broken pieces, removing color deviations and restoring original tones...',

    // Logs
    'log.starting': 'System initializing...',
    'log.aiEngine': 'Gemini AI engine activating...',
    'log.googleDb': 'Cross-querying Google global database...',
    'log.scanning': 'Scanning image and verifying literature...',
    'log.verifying': 'Verifying data...',
    'log.materialSpectrum': 'Verifying material spectrum...',
    'log.colorCast': 'Removing color cast deviations...',
    'log.restorationDone': 'Restoration complete: Original color tones recovered.',
    'log.systemLogs': 'System Logs',
    'log.live': 'LIVE',

    // Errors
    'error.noImage': 'No image selected.',
    'error.emptyResponse': 'API returned empty response.',
    'error.analysis': 'Error during analysis: ',
    'error.model404': 'Model not found (404). Check API access permissions.',
    'error.restoration': 'Restoration Error: ',
    'error.imageGen': 'Could not generate image.',
    'error.invalidUrl': 'Invalid URL. Please enter a valid image URL.',
    'error.urlFetch': 'Could not fetch image from URL.',

    // History
    'history.title': 'Analysis History',
    'history.empty': 'No analyses yet.',
    'history.clear': 'Clear History',
    'history.load': 'Load',

    // Chat
    'chat.title': 'Ask About the Artifact',
    'chat.placeholder': 'Type a question about the artifact...',
    'chat.send': 'Send',
    'chat.thinking': 'Thinking...',

    // Share
    'share.title': 'Share Analysis Result',
    'share.copyLink': 'Copy Link',
    'share.copied': 'Copied!',
    'share.twitter': 'Share on Twitter',
    'share.whatsapp': 'Share on WhatsApp',
    'share.download': 'Download as PDF',

    // PDF
    'pdf.title': 'Analysis Report',
    'pdf.download': 'Download PDF',
    'pdf.generating': 'Generating PDF...',

    // Map
    'map.title': 'Artifact Location',
    'map.noLocation': 'Location not available.',

    // Timeline
    'timeline.title': 'Historical Timeline',

    // Theme
    'theme.dark': 'Dark Mode',
    'theme.light': 'Light Mode',

    // Footer
    'footer.system': 'ArcheLens Open Source System',

    // Common
    'common.loading': 'Loading...',

    // Help
    'help.title': 'User Guide',
    'help.version': 'ArcheLens Open Source',
    'help.section1Title': '1. Analysis Process',
    'help.section1Desc': 'The app analyzes uploaded images using a configurable Google Gemini AI model and Google Search infrastructure. The system identifies artifacts, determines dates, and cross-references museum databases.',
    'help.section1Tip': 'For best results, use a clear, well-lit photo of the artifact on a plain background.',
    'help.section2Title': '2. Restoration Protocols',
    'help.section3Title': '3. Restoration Modes',

    // Museum Dict (English to English fallback)
    'museum.dict.heykel': 'sculpture',
    'museum.dict.seramik': 'ceramic',
    'museum.dict.vazo': 'vase',
    'museum.dict.sikke': 'coin',
    'museum.dict.kılıç': 'sword',
    'museum.dict.kalkan': 'shield',
    'museum.dict.miğfer': 'helmet',
    'museum.dict.zırh': 'armor',
    'museum.dict.takı': 'jewelry',
    'museum.dict.yüzük': 'ring',
    'museum.dict.kolye': 'necklace',
    'museum.dict.küpe': 'earring',
    'museum.dict.bilezik': 'bracelet',
    'museum.dict.kandil': 'oil lamp',
    'museum.dict.lahit': 'sarcophagus',
    'museum.dict.mezar': 'tomb',
    'museum.dict.mozaik': 'mosaic',
    'museum.dict.fresk': 'fresco',
    'museum.dict.kase': 'bowl',
    'museum.dict.tabak': 'plate',
    'museum.dict.çömlek': 'pottery',
    'museum.dict.figürin': 'figurine',
    'museum.dict.taç': 'crown',
    'museum.dict.mühür': 'seal',
    'museum.dict.silah': 'weapon',
    'museum.dict.balta': 'axe',
    'museum.dict.hançer': 'dagger',
    'museum.dict.yunan': 'greek',
    'museum.dict.roma': 'roman',
    'museum.dict.mısır': 'egyptian',
    'museum.dict.pers': 'persian',
    'museum.dict.hitit': 'hittite',
    'museum.dict.sümer': 'sumerian',
    'museum.dict.babil': 'babylonian',
    'museum.dict.bizans': 'byzantine',
    'museum.dict.osmanlı': 'ottoman',
    'museum.dict.fenike': 'phoenician',
    'museum.dict.asur': 'assyrian',

    // Audio Guide
    'audio.title': 'Audio Guide',
    'audio.subtitle': 'Listen to the analysis',
    'audio.playing': 'Now playing...',
    'audio.paused': 'Paused',
    'audio.play': 'Listen',
    'audio.pause': 'Pause',
    'audio.resume': 'Resume',
    'audio.stop': 'Stop',
    'audio.speed': 'Speed',
    'audio.unsupported': 'Your browser does not support text-to-speech.',
};
