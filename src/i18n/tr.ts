import { Translations } from '../types';

export const tr: Translations = {
    // Navbar
    'nav.title': 'ARCHE LENS',
    'nav.subtitle': 'Kültürel miras için açık araçlar',
    'nav.howItWorks': 'Nasıl Çalışır?',
    'nav.newAnalysis': 'Yeni Analiz',
    'nav.history': 'Geçmiş',
    'nav.language': 'Dil',

    // Upload
    'upload.heading': 'Geçmişi',
    'upload.headingHighlight': 'Çözümle',
    'upload.description': 'Yapay zeka destekli profesyonel arkeolojik analiz ve dijital restorasyon platformu.',
    'upload.aiEngine': 'Google Gemini AI & ArcheLens Vision',
    'upload.button': 'Eser Yükle',
    'upload.formats': 'JPG • PNG • WEBP',
    'upload.dragDrop': 'Görseli buraya sürükleyin',
    'upload.orUrl': 'veya URL ile analiz et',
    'upload.urlPlaceholder': 'Görsel URL\'si yapıştırın...',
    'upload.urlAnalyze': 'Analiz Et',
    'upload.camera': 'Kamera ile Çek',

    // Analysis
    'analysis.report': 'Analiz Raporu',
    'analysis.confidence': 'Güven Skoru',
    'analysis.overview': 'Genel Bakış',
    'analysis.academic': 'Akademik & Epigrafi',
    'analysis.technical': 'Teknik & Kondisyon',
    'analysis.map': 'Harita',
    'analysis.timeline': 'Zaman Çizelgesi',
    'analysis.chat': 'Sohbet',
    'analysis.description': 'Eser Analizi',
    'analysis.sources': 'Akademik Kaynaklar (Google Search)',
    'analysis.funFact': 'Biliyor muydunuz?',
    'analysis.curatorNote': 'Küratörün Notu',
    'analysis.dateRange': 'Tarih Aralığı',
    'analysis.period': 'Dönem',
    'analysis.iconography': 'İkonografi & Sembolizm',
    'analysis.inscription': 'Antik Yazıt Analizi',
    'analysis.originalText': 'Orijinal Metin',
    'analysis.translation': 'Türkçe Çeviri',
    'analysis.academicNote': 'Akademik Yorum',
    'analysis.techSpecs': 'Teknik Özellikler',
    'analysis.material': 'Malzeme',
    'analysis.technique': 'Teknik',
    'analysis.dimensions': 'Boyut',
    'analysis.condition': 'Kondisyon Raporu',
    'analysis.historicalContext': 'Tarihsel Bağlam',
    'analysis.culturalSignificance': 'Kültürel Önem',
    'analysis.symbolism': 'Sembolizm',
    'analysis.similarArtifacts': 'Benzer Eserler',
    'analysis.share': 'Paylaş',
    'analysis.museum': 'Müze',

    // Restoration
    'restore.start': 'Restorasyonu Başlat',
    'restore.redo': 'Yeniden İşle',
    'restore.compare': 'Karşılaştır',
    'restore.download': 'Görseli İndir',
    'restore.mode': 'Restorasyon Modu',
    'restore.auto': 'BAĞLAMSAL ONARIM',
    'restore.manual': 'MANUEL',
    'restore.autoDesc': 'Yapay zeka, kırık parçaları tamamlar ve renk doğruluğunu (color accuracy) sağlayarak istenmeyen renk sapmalarını giderir, eserin orijinal tonlarını ortaya çıkarır.',
    'restore.manualPlaceholder': 'Örn: Sol köşedeki kırık parçayı gümüş kaplama ile tamamla...',
    'restore.manualHint': 'Detaylı talimatlar verin.',
    'restore.original': 'ORİJİNAL DURUM',
    'restore.restoring': 'Restorasyon',
    'restore.engine': 'ArcheLens Open Source - AI Restoration Engine',
    'restore.restoringDesc': 'Yüzey temizliği yapılıyor, yapısal kusurlar onarılıyor ve renk spektrumu orijinal haline getiriliyor...',

    // Logs
    'log.starting': 'Sistem başlatılıyor...',
    'log.aiEngine': 'Gemini AI motoru devreye alınıyor...',
    'log.googleDb': 'Google Global Veritabanı çapraz sorgulanıyor...',
    'log.scanning': 'Görsel taranıyor ve literatür doğrulanıyor...',
    'log.verifying': 'Veriler doğrulanıyor...',
    'log.materialSpectrum': 'Malzeme spektrumu doğrulanıyor...',
    'log.colorCast': 'Renk sapmaları (Color Cast) gideriliyor...',
    'log.restorationDone': 'Restorasyon tamamlandı: Orijinal renk tonları geri kazanıldı.',
    'log.systemLogs': 'Sistem Logları',
    'log.live': 'CANLI',

    // Errors
    'error.noImage': 'Görsel seçilmedi.',
    'error.emptyResponse': 'API boş yanıt döndürdü.',
    'error.analysis': 'Analiz sırasında hata: ',
    'error.model404': 'Model bulunamadı (404). API erişim izinlerini kontrol edin.',
    'error.restoration': 'Restorasyon Hatası: ',
    'error.imageGen': 'Görsel oluşturulamadı.',
    'error.invalidUrl': 'Geçersiz URL. Lütfen geçerli bir görsel URL\'si girin.',
    'error.urlFetch': 'URL\'den görsel alınamadı.',

    // History
    'history.title': 'Analiz Geçmişi',
    'history.empty': 'Henüz analiz yapılmadı.',
    'history.clear': 'Geçmişi Temizle',
    'history.load': 'Yükle',

    // Chat
    'chat.title': 'Eser Hakkında Soru Sorun',
    'chat.placeholder': 'Eser hakkında bir soru yazın...',
    'chat.send': 'Gönder',
    'chat.thinking': 'Düşünüyor...',

    // Share
    'share.title': 'Analiz Sonucunu Paylaş',
    'share.copyLink': 'Linki Kopyala',
    'share.copied': 'Kopyalandı!',
    'share.twitter': 'Twitter\'da Paylaş',
    'share.whatsapp': 'WhatsApp\'ta Paylaş',
    'share.download': 'PDF Olarak İndir',

    // PDF
    'pdf.title': 'Analiz Raporu',
    'pdf.download': 'PDF İndir',
    'pdf.generating': 'PDF Oluşturuluyor...',

    // Map
    'map.title': 'Eserin Konumu',
    'map.noLocation': 'Konum bilgisi bulunamadı.',

    // Timeline
    'timeline.title': 'Tarihsel Zaman Çizelgesi',

    // Theme
    'theme.dark': 'Karanlık Mod',
    'theme.light': 'Aydınlık Mod',

    // Footer
    'footer.system': 'ArcheLens Open Source Sistemi',

    // Common
    'common.loading': 'Yükleniyor...',

    // Help modal
    'help.title': 'Kullanım Kılavuzu',
    'help.version': 'ArcheLens Open Source',
    'help.section1Title': '1. Analiz Süreci',
    'help.section1Desc': 'Uygulama, yüklediğiniz görseli yapılandırılabilir Google Gemini yapay zeka modeli ve Google Search altyapısı ile analiz eder. Sistem, eseri tanımlar, tarihini belirler ve müze veritabanlarından doğrulama yapar.',
    'help.section1Tip': 'En iyi sonuç için eserin net, iyi ışıklandırılmış ve düz bir arka planda çekilmiş fotoğrafını kullanın.',
    'help.section2Title': '2. Restorasyon Protokolleri',
    'help.section3Title': '3. Restorasyon Modları',

    // Museum Dict (Turkish to English)
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
    'audio.title': 'Sesli Rehber',
    'audio.subtitle': 'Analiz sonuçlarını dinleyin',
    'audio.playing': 'Oynatılıyor...',
    'audio.paused': 'Duraklatıldı',
    'audio.play': 'Dinle',
    'audio.pause': 'Duraklat',
    'audio.resume': 'Devam',
    'audio.stop': 'Durdur',
    'audio.speed': 'Hız',
    'audio.unsupported': 'Tarayıcınız sesli okuma özelliğini desteklemiyor.',
};
