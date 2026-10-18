import { dict as en } from "./en"

type Keys = keyof typeof en

export const dict = {
  "desktop.menu.app": "AllCode",
  "desktop.menu.file": "Dosya",
  "desktop.menu.edit": "Düzen",
  "desktop.menu.view": "Görünüm",
  "desktop.menu.go": "Git",
  "desktop.menu.window": "Pencere",
  "desktop.menu.help": "Yardim",
  "desktop.menu.checkForUpdates": "Güncellemeleri kontrol et...",
  "desktop.menu.settings": "Ayarlar",
  "desktop.menu.reloadWebview": "Web görünümünü yeniden yükle",
  "desktop.menu.restart": "Yeniden baslat",
  "desktop.menu.exportLogs": "Günlükleri disa aktar...",
  "desktop.menu.newSession": "Yeni oturum",
  "desktop.menu.openProject": "Proje aç...",
  "desktop.menu.newWindow": "Yeni pencere",
  "desktop.menu.closeWindow": "Pencereyi kapat",
  "desktop.menu.undo": "Geri al",
  "desktop.menu.redo": "Yinele",
  "desktop.menu.cut": "Kes",
  "desktop.menu.copy": "Kopyala",
  "desktop.menu.paste": "Yapistir",
  "desktop.menu.delete": "Sil",
  "desktop.menu.selectAll": "Tümünü seç",
  "desktop.menu.toggleSidebar": "Kenar çubugunu aç/kapat",
  "desktop.menu.toggleTerminal": "Terminali aç/kapat",
  "desktop.menu.toggleFileTree": "Dosya agacini aç/kapat",
  "desktop.menu.reload": "Yeniden yükle",
  "desktop.menu.toggleDeveloperTools": "Gelistirici araçlarini aç/kapat",
  "desktop.menu.actualSize": "Gerçek boyut",
  "desktop.menu.zoomIn": "Yakinlastir",
  "desktop.menu.zoomOut": "Uzaklastir",
  "desktop.menu.toggleFullScreen": "Tam ekrani aç/kapat",
  "desktop.menu.back": "Geri",
  "desktop.menu.forward": "Ileri",
  "desktop.menu.previousSession": "Önceki oturum",
  "desktop.menu.nextSession": "Sonraki oturum",
  "desktop.menu.previousProject": "Önceki proje",
  "desktop.menu.nextProject": "Sonraki proje",
  "desktop.menu.minimize": "Simge durumuna küçült",
  "desktop.menu.maximize": "Ekrani kapla",
  "desktop.menu.documentation": "OpenCode belgeleri",
  "desktop.menu.supportForum": "Destek forumu",
  "desktop.menu.shareFeedback": "Geri bildirim paylas",
  "desktop.menu.reportBug": "Hata bildir",
  "desktop.menu.ariaLabel": "OpenCode menüsü",

  "desktop.updater.dialog.checkFailed.message": "Güncellemeler kontrol edilemedi.",
  "desktop.updater.dialog.checkFailed.title": "Güncelleme hatasi",
  "desktop.updater.dialog.upToDate.message": "En son sürümü kullaniyorsunuz.",
  "desktop.updater.dialog.upToDate.title": "Güncelleme yok",
  "desktop.updater.dialog.ready.message": "{{version}} güncellemesi indirildi. Simdi yeniden baslatilsin mi?",
  "desktop.updater.dialog.ready.title": "Güncelleme hazir",
  "desktop.updater.dialog.restart": "Yeniden baslat",
  "desktop.updater.dialog.later": "Daha sonra",

  "desktop.recovery.action.relaunch": "Uygulamayi yeniden baslat",
  "desktop.recovery.action.exportLogs": "Günlükleri disa aktar",
  "desktop.recovery.action.keepWaiting": "Beklemeye devam et",
  "desktop.recovery.action.quit": "Çik",
  "desktop.recovery.loadFailed": "OpenCode yüklenemedi",
  "desktop.recovery.terminated": "OpenCode penceresi beklenmedik sekilde sonlandirildi",
  "desktop.recovery.unresponsive": "OpenCode yanit vermiyor",
  "desktop.recovery.unresponsive.detail":
    "Uygulamayi yeniden baslatabilir, günlükleri açabilir veya beklemeye devam edebilirsiniz.",
  "desktop.recovery.loadFailed.detail": "Pencere: {{window}}\nURL: {{url}}\nHata: {{code}} {{description}}",
  "desktop.recovery.terminated.detail": "Pencere: {{window}}\nNeden: {{reason}}\nKod: {{code}}",
  "desktop.recovery.unknown": "<bilinmiyor>",

  "desktop.dialog.chooseFolder": "Bir klasör seçin",
  "desktop.dialog.chooseFile": "Bir dosya seçin",
  "desktop.dialog.saveFile": "Dosyayi kaydedin",
  "desktop.dialog.files": "Dosyalar",
  "desktop.server.local": "Yerel sunucu",

  "desktop.wsl.error.windowsOnly": "WSL yalnizca Windows'ta kullanilabilir",
  "desktop.wsl.error.unavailable": "WSL kullanilamiyor",
  "desktop.wsl.error.listInstalled": "Kurulu WSL dagitimlari listelenemedi",
  "desktop.wsl.error.listOnline": "Çevrimiçi WSL dagitimlari listelenemedi",
  "desktop.wsl.error.executeDistro": "Dagitimda komutlar çalistirilamiyor",
  "desktop.wsl.error.installWsl": "WSL kurulamadi",
  "desktop.wsl.error.installDistro": "Dagitim kurulamadi: {{distro}}",
  "desktop.wsl.error.installOpencode": "OpenCode kurulamadi",
  "desktop.wsl.error.alreadyAdded": "{{distro}} zaten eklendi",
  "desktop.wsl.error.opencodeMissing": "opencode bu dagitimda kurulu degil",
  "desktop.wsl.error.opencodeCannotRun": "opencode kurulu ancak çalistirilamadi",
  "desktop.wsl.error.opencodeNotInstalled": "OpenCode, {{distro}} içinde kurulu degil",
  "desktop.wsl.error.updateVersion":
    "OpenCode güncellemesi tamamlandi ancak {{distro}} hâlâ {{installed}} sürümünü bildiriyor; beklenen sürüm: {{expected}}",
  "desktop.wsl.error.noVersion": "sürüm yok",
  "desktop.wsl.error.serverExited": "WSL sunucusu baslatildiktan sonra kapandi (code={{code}} signal={{signal}})",
  "desktop.wsl.error.serverExitedBeforeHealthy":
    "WSL sunucusu kullanima hazir duruma gelmeden kapandi (code={{code}} signal={{signal}}){{output}}",
  "desktop.wsl.error.healthTimeout":
    "{{distro}} Sidecar sistem durumu denetimi {{timeout}} ms sonra zaman asimina ugradi",
  "desktop.wsl.error.commandTimeout": "{{command}} {{args}} komutu {{timeout}} ms sonra zaman asimina ugradi",
  "desktop.wsl.error.failedPort": "Baglanti noktasi alinamadi",

  "desktop.picker.error.notSelected": "Dosya seçici tarafindan dosya seçilmedi",
  "desktop.picker.error.sizeLimit": "Seçilen ekler {{limit}} MB sinirini asiyor",

  "command.category.suggested": "Önerilen",
  "command.category.view": "Görünüm",
  "command.category.project": "Proje",
  "command.category.provider": "Saglayici",
  "command.category.server": "Sunucu",
  "command.category.session": "Oturum",
  "command.category.theme": "Tema",
  "command.category.language": "Dil",
  "command.category.file": "Dosya",
  "command.category.context": "Baglam",
  "command.category.terminal": "Terminal",
  "command.category.model": "Model",
  "command.category.mcp": "MCP",
  "command.category.agent": "Ajan",
  "command.category.permissions": "Izinler",
  "command.category.workspace": "Çalisma Alani",
  "command.category.settings": "Ayarlar",
  "command.logs.export": "Günlükleri disa aktar",

  "theme.scheme.system": "Sistem",
  "theme.scheme.light": "Açik",
  "theme.scheme.dark": "Koyu",

  "command.sidebar.toggle": "Kenar çubugunu aç/kapat",
  "command.project.open": "Proje aç",
  "command.project.previous": "Önceki proje",
  "command.project.next": "Sonraki proje",
  "command.project.index": "{{index}} numarali projeye geç",
  "command.provider.connect": "Saglayici bagla",
  "command.server.switch": "Sunucu degistir",
  "command.settings.open": "Ayarlari aç",
  "command.session.previous": "Önceki oturum",
  "command.session.next": "Sonraki oturum",
  "command.session.previous.unseen": "Önceki okunmamis oturum",
  "command.session.next.unseen": "Sonraki okunmamis oturum",
  "command.session.archive": "Oturumu arsivle",

  "command.palette": "Komut paleti",

  "command.theme.cycle": "Tema degistir",
  "command.theme.set": "Tema kullan: {{theme}}",
  "command.theme.scheme.cycle": "Renk semasini degistir",
  "command.theme.scheme.set": "Renk semasi kullan: {{scheme}}",

  "command.language.cycle": "Dil degistir",
  "command.language.set": "Dil kullan: {{language}}",

  "command.session.new": "Yeni oturum",
  "command.file.open": "Dosya aç",
  "command.tab.close": "Sekmeyi kapat",
  "command.tab.reopenClosed": "Kapatilan sekmeyi yeniden aç",
  "command.context.addSelection": "Seçimi baglama ekle",
  "command.context.addSelection.description": "Mevcut dosyadan seçili satirlari ekle",
  "command.input.focus": "Girisi odakla",
  "command.terminal.toggle": "Terminali aç/kapat",
  "command.fileTree.toggle": "Dosya agacini aç/kapat",
  "command.review.toggle": "Incelemeyi aç/kapat",
  "command.terminal.new": "Yeni terminal",
  "command.terminal.new.description": "Yeni bir terminal sekmesi olustur",
  "command.steps.toggle": "Adimlari aç/kapat",
  "command.steps.toggle.description": "Mevcut mesaj için adimlari göster veya gizle",
  "command.message.previous": "Önceki mesaj",
  "command.message.previous.description": "Önceki kullanici mesajina git",
  "command.message.next": "Sonraki mesaj",
  "command.message.next.description": "Sonraki kullanici mesajina git",
  "command.model.choose": "Model seç",
  "command.model.choose.description": "Farkli bir model seç",
  "command.mcp.toggle": "MCP'leri aç/kapat",
  "command.mcp.toggle.description": "MCP'leri aç/kapat",
  "command.agent.cycle": "Ajan degistir",
  "command.agent.cycle.description": "Sonraki ajana geç",
  "command.agent.cycle.reverse": "Ajani geri degistir",
  "command.agent.cycle.reverse.description": "Önceki ajana geç",
  "command.model.variant.cycle": "Düsünme eforu degistir",
  "command.model.variant.cycle.description": "Sonraki efor seviyesine geç",
  "command.prompt.mode.shell": "Kabuk",
  "command.prompt.mode.normal": "Istem",
  "command.permissions.autoaccept.enable": "Izinleri otomatik kabul et",
  "command.permissions.autoaccept.disable": "Izinleri otomatik kabul etmeyi durdur",
  "command.workspace.toggle": "Çalisma alanlarini aç/kapat",
  "command.workspace.toggle.description": "Kenar çubugunda birden fazla çalisma alanini göster veya gizle",
  "command.session.undo": "Geri al",
  "command.session.undo.description": "Son mesaji geri al",
  "command.session.redo": "Yinele",
  "command.session.redo.description": "Son geri alinan mesaji yinele",
  "command.session.compact": "Oturumu sikistir",
  "command.session.compact.description": "Baglam boyutunu azaltmak için oturumu özetle",
  "command.session.fork": "Mesajdan dallandir",
  "command.session.fork.description": "Önceki bir mesajdan yeni oturum olustur",
  "command.session.share": "Oturumu paylas",
  "command.session.share.description": "Bu oturumu paylas ve URL'yi panoya kopyala",
  "command.session.unshare": "Paylasimi kaldir",
  "command.session.unshare.description": "Bu oturumun paylasimini durdur",

  "command.session.export": "Oturumu disa aktar",
  "command.session.export.description": "Oturumun tam dökümünü JSON olarak disa aktar",

  "palette.search.placeholder": "Dosya, komut ve oturum ara",
  "palette.search.placeholder.home": "Komut ve oturum ara",
  "palette.empty": "Sonuç bulunamadi",
  "palette.group.commands": "Komutlar",
  "palette.group.files": "Dosyalar",

  "dialog.provider.search.placeholder": "Saglayici ara",
  "dialog.provider.empty": "Saglayici bulunamadi",
  "dialog.provider.group.popular": "Popüler",
  "dialog.provider.group.other": "Diger",
  "dialog.provider.custom.label": "Özel OpenAI uyumlu saglayici",
  "dialog.provider.tag.recommended": "Önerilen",
  "dialog.provider.opencode.note": "Claude, GPT, Gemini ve daha fazlasini içeren seçilmis modeller",
  "dialog.provider.opencode.tagline": "Güvenilir, optimize edilmis modeller",
  "dialog.provider.opencodeGo.tagline": "Herkes için düsük maliyetli abonelik",
  "dialog.provider.anthropic.note": "Pro ve Max dahil Claude modellerine dogrudan erisim",
  "dialog.provider.copilot.note": "GitHub Copilot üzerinden kodlama yardimi için yapay zekâ modelleri",
  "dialog.provider.openai.note": "Hizli ve yetenekli genel yapay zekâ görevleri için GPT modelleri",
  "dialog.provider.google.note": "Hizli ve yapilandirilmis yanitlar için Gemini modelleri",
  "dialog.provider.openrouter.note": "Tek bir saglayicidan tüm desteklenen modellere eris",
  "dialog.provider.vercel.note": "Akilli yönlendirme ile yapay zekâ modellerine birlesik erisim",

  "dialog.model.select.title": "Model seç",
  "dialog.model.search.placeholder": "Model ara",
  "dialog.model.empty": "Model sonucu yok",
  "dialog.model.manage": "Modelleri yönet",
  "dialog.model.manage.description": "Model seçicide hangi modellerin görünecegini özellestirin.",
  "dialog.model.manage.provider.toggle": "Tüm {{provider}} modellerini aç/kapat",

  "dialog.model.unpaid.freeModels.title": "OpenCode tarafindan sunulan ücretsiz modeller",
  "dialog.model.unpaid.addMore.title": "Popüler saglayicilardan daha fazla model ekleyin",
  "dialog.model.unpaid.viewMoreProviders": "70'ten fazla saglayici daha görüntüle",

  "dialog.provider.viewAll": "Daha fazla saglayici göster",

  "provider.connect.title": "{{provider}} bagla",
  "provider.connect.title.anthropicProMax": "Claude Pro/Max ile giris yap",
  "provider.connect.selectMethod": "{{provider}} için giris yöntemini seçin.",
  "provider.connect.method.apiKey": "API anahtari",
  "provider.connect.method.browser": "Tarayici",
  "provider.connect.method.headless": "Tarayicisiz",
  "provider.connect.status.inProgress": "Yetkilendirme devam ediyor...",
  "provider.connect.status.waiting": "Yetkilendirme bekleniyor...",
  "provider.connect.status.failed": "Yetkilendirme basarisiz: {{error}}",
  "provider.connect.apiKey.description":
    "{{provider}} hesabinizi baglamak ve OpenCode'da {{provider}} modellerini kullanmak için API anahtarinizi girin.",
  "provider.connect.apiKey.label": "{{provider}} API anahtari",
  "provider.connect.apiKey.placeholder": "API anahtari",
  "provider.connect.apiKey.required": "API anahtari gerekli",
  "provider.connect.opencodeZen.line1":
    "OpenCode Zen, kodlama ajanlari için seçilmis güvenilir optimize edilmis modellere erisim saglar.",
  "provider.connect.opencodeZen.line2":
    "Tek bir API anahtariyla Claude, GPT, Gemini, GLM ve daha fazlasi gibi modellere erisebilirsiniz.",
  "provider.connect.opencodeZen.visit.prefix": "",
  "provider.connect.opencodeZen.visit.link": "opencode.ai/zen",
  "provider.connect.opencodeZen.visit.suffix": " adresini ziyaret ederek API anahtarinizi alin.",
  "provider.connect.oauth.code.visit.prefix": "Yetkilendirme kodunuzu almak için ",
  "provider.connect.oauth.code.visit.link": "bu baglantiya",
  "provider.connect.oauth.code.visit.suffix":
    " gidin; ardindan hesabinizi baglayarak OpenCode'da {{provider}} modellerini kullanin.",
  "provider.connect.oauth.code.label": "{{method}} yetkilendirme kodu",
  "provider.connect.oauth.code.placeholder": "Yetkilendirme kodu",
  "provider.connect.oauth.code.required": "Yetkilendirme kodu gerekli",
  "provider.connect.oauth.code.invalid": "Geçersiz yetkilendirme kodu",
  "provider.connect.oauth.auto.visit.prefix": "",
  "provider.connect.oauth.auto.visit.link": "Bu baglantiya",
  "provider.connect.oauth.auto.visit.suffix":
    " tiklayarak asagidaki kodu girin ve hesabinizi baglayarak OpenCode'da {{provider}} modellerini kullanin.",
  "provider.connect.oauth.auto.confirmationCode": "Onay kodu",
  "provider.connect.toast.connected.title": "{{provider}} baglandi",
  "provider.connect.toast.connected.description": "{{provider}} modelleri artik kullanimda.",

  "provider.custom.title": "Özel saglayici",
  "provider.custom.unavailable": "Özel saglayicilar bu sunucuda kullanilamiyor",
  "provider.custom.description.prefix": "OpenAI uyumlu bir saglayici yapilandirin. ",
  "provider.custom.description.link": "saglayici yapilandirma dokümanlari",
  "provider.custom.description.suffix": " sayfasina bakin.",
  "provider.custom.field.providerID.label": "Saglayici kimligi",
  "provider.custom.field.providerID.placeholder": "saglayicim",
  "provider.custom.field.providerID.description": "Küçük harfler, rakamlar, tire veya alt çizgi",
  "provider.custom.field.name.label": "Görünen ad",
  "provider.custom.field.name.placeholder": "Yapay Zekâ Saglayicim",
  "provider.custom.field.baseURL.label": "Temel URL",
  "provider.custom.field.baseURL.placeholder": "https://api.saglayicim.com/v1",
  "provider.custom.field.apiKey.label": "API anahtari",
  "provider.custom.field.apiKey.placeholder": "API anahtari",
  "provider.custom.field.apiKey.description":
    "Istege bagli. Kimlik dogrulamayi basliklarla yönetiyorsaniz bos birakin.",
  "provider.custom.models.label": "Modeller",
  "provider.custom.models.id.label": "Kimlik",
  "provider.custom.models.id.placeholder": "model-kimlik",
  "provider.custom.models.name.label": "Ad",
  "provider.custom.models.name.placeholder": "Görünen Ad",
  "provider.custom.models.remove": "Modeli kaldir",
  "provider.custom.models.add": "Model ekle",
  "provider.custom.headers.label": "Basliklar (istege bagli)",
  "provider.custom.headers.key.label": "Baslik",
  "provider.custom.headers.key.placeholder": "Baslik-Adi",
  "provider.custom.headers.value.label": "Deger",
  "provider.custom.headers.value.placeholder": "deger",
  "provider.custom.headers.remove": "Basligi kaldir",
  "provider.custom.headers.add": "Baslik ekle",
  "provider.custom.error.providerID.required": "Saglayici kimligi gerekli",
  "provider.custom.error.providerID.format": "Küçük harf, rakam, tire veya alt çizgi kullanin",
  "provider.custom.error.providerID.exists": "Bu saglayici kimligi zaten mevcut",
  "provider.custom.error.name.required": "Görünen ad gerekli",
  "provider.custom.error.baseURL.required": "Temel URL gerekli",
  "provider.custom.error.baseURL.format": "http:// veya https:// ile baslamali",
  "provider.custom.error.required": "Gerekli",
  "provider.custom.error.duplicate": "Tekrar",

  "provider.disconnect.toast.disconnected.title": "{{provider}} baglantisi kesildi",
  "provider.disconnect.toast.disconnected.description": "{{provider}} modelleri artik kullanilamiyor.",

  "model.tag.free": "Ücretsiz",
  "model.tag.latest": "En yeni",
  "model.provider.anthropic": "Anthropic",
  "model.provider.openai": "OpenAI",
  "model.provider.google": "Google",
  "model.provider.xai": "xAI",
  "model.provider.meta": "Meta",
  "model.input.text": "metin",
  "model.input.image": "görsel",
  "model.input.audio": "ses",
  "model.input.video": "video",
  "model.input.pdf": "pdf",
  "model.tooltip.allows": "Kabul eder: {{inputs}}",
  "model.tooltip.context.label": "Baglam",
  "model.tooltip.inputs": "Girdiler",
  "model.tooltip.model": "Model",
  "model.tooltip.provider": "Saglayici",
  "model.tooltip.reasoning": "Akil yürütme",
  "model.tooltip.reasoning.allowed": "Akil yürütmeyi destekler",
  "model.tooltip.reasoning.none": "Akil yürütme yok",
  "model.tooltip.context": "Baglam siniri {{limit}}",

  "common.search.placeholder": "Ara",
  "common.goBack": "Geri git",
  "common.goForward": "Ileri git",
  "common.loading": "Yükleniyor",
  "common.loading.ellipsis": "...",
  "common.cancel": "Iptal",
  "common.clear": "Temizle",
  "common.connect": "Baglan",
  "common.disconnect": "Baglantiyi kes",
  "common.continue": "Devam et",
  "common.submit": "Gönder",
  "common.save": "Kaydet",
  "common.saving": "Kaydediliyor...",
  "common.default": "Varsayilan",
  "common.attachment": "ek",

  "prompt.placeholder.shell": "Kabuk komutu girin... {{example}}",
  "prompt.placeholder.normal": 'Bir seyler sorun... "{{example}}"',
  "prompt.placeholder.simple": "Bir seyler sorun...",
  "prompt.placeholder.summarizeComments": "Yorumlari özetle…",
  "prompt.placeholder.summarizeComment": "Yorumu özetle…",
  "prompt.mode.shell": "Kabuk",
  "prompt.mode.normal": "Istem",
  "prompt.mode.shell.exit": "çikmak için esc",
  "session.child.promptDisabled": "Alt ajan oturumlarina istem gönderilemez.",
  "session.child.backToParent": "Ana oturuma dön.",

  "prompt.example.1": "Kod tabanindaki bir TODO'yu düzelt",
  "prompt.example.2": "Bu projenin teknoloji yigini nedir?",
  "prompt.example.3": "Bozuk testleri düzelt",
  "prompt.example.4": "Kimlik dogrulamanin nasil çalistigini açikla",
  "prompt.example.5": "Güvenlik açiklari bul ve düzelt",
  "prompt.example.6": "Kullanici servisi için birim testleri ekle",
  "prompt.example.7": "Bu fonksiyonu daha okunabilir hale getir",
  "prompt.example.8": "Bu hata ne anlama geliyor?",
  "prompt.example.9": "Bu sorunu ayiklamama yardim et",
  "prompt.example.10": "API dokümantasyonu olustur",
  "prompt.example.11": "Veritabani sorgularini optimize et",
  "prompt.example.12": "Girdi dogrulama ekle",
  "prompt.example.13": "... için yeni bir bilesen olustur",
  "prompt.example.14": "Bu projeyi nasil dagitabilirim?",
  "prompt.example.15": "Kodumu en iyi uygulamalar için incele",
  "prompt.example.16": "Bu fonksiyona hata yönetimi ekle",
  "prompt.example.17": "Bu regex kalibini açikla",
  "prompt.example.18": "Bunu TypeScript'e dönüstür",
  "prompt.example.19": "Kod tabaninin tamamina günlük kaydi ekle",
  "prompt.example.20": "Hangi bagimliliklar güncellenmemis?",
  "prompt.example.21": "Bir geçis betigi yazmama yardim et",
  "prompt.example.22": "Bu uç nokta için önbellekleme uygula",
  "prompt.example.23": "Bu listeye sayfalama ekle",
  "prompt.example.24": "... için bir CLI komutu olustur",
  "prompt.example.25": "Ortam degiskenleri burada nasil çalisiyor?",

  "prompt.popover.emptyResults": "Eslesen sonuç yok",
  "prompt.popover.emptyCommands": "Eslesen komut yok",
  "prompt.dropzone.label": "Resimleri, PDF'leri veya metin dosyalarini buraya birakin",
  "prompt.dropzone.file.label": "Dosyayi @ ile belirtmek için buraya birakin",
  "prompt.slash.badge.custom": "özel",
  "prompt.slash.badge.skill": "beceri",
  "prompt.slash.badge.mcp": "mcp",
  "prompt.context.active": "etkin",
  "prompt.context.includeActiveFile": "Etkin dosyayi dahil et",
  "prompt.context.removeActiveFile": "Etkin dosyayi baglamdan çikar",
  "prompt.context.removeFile": "Dosyayi baglamdan çikar",
  "prompt.action.attachFile": "Dosya ekle",
  "prompt.menu.addImagesAndFiles": "Dosya ve daha fazlasini ekle",
  "prompt.menu.imagesAndFiles": "Görseller ve dosyalar",
  "prompt.menu.commands": "Komutlar",
  "prompt.menu.context": "Baglam",
  "prompt.menu.shellCommand": "Kabuk komutu",
  "prompt.attachment.remove": "Eki kaldir",
  "prompt.action.send": "Gönder",
  "prompt.action.stop": "Durdur",

  "prompt.toast.pasteUnsupported.title": "Desteklenmeyen ek",
  "prompt.toast.attachmentDuplicate.title": "Bu dosya zaten yüklendi",
  "prompt.toast.pasteUnsupported.description": "Buraya yalnizca resimler, PDF'ler veya metin dosyalari eklenebilir.",
  "prompt.toast.modelAgentRequired.title": "Bir ajan ve model seçin",
  "prompt.toast.modelAgentRequired.description": "Istem göndermeden önce bir ajan ve model seçin.",
  "prompt.toast.worktreeCreateFailed.title": "Çalisma agaci olusturulamadi",
  "prompt.toast.sessionCreateFailed.title": "Oturum olusturulamadi",
  "prompt.toast.shellSendFailed.title": "Kabuk komutu gönderilemedi",
  "prompt.toast.commandSendFailed.title": "Komut gönderilemedi",
  "prompt.toast.promptSendFailed.title": "Istem gönderilemedi",
  "prompt.toast.promptSendFailed.description": "Oturum alinamadi",

  "dialog.mcp.title": "MCP'ler",
  "dialog.mcp.description": "Toplam {{total}} ögeden {{enabled}} tanesi etkin",
  "dialog.mcp.empty": "Yapilandirilmis MCP yok",

  "dialog.lsp.empty": "LSP'ler dosya türlerinden otomatik algilanir",
  "dialog.plugins.empty": "Eklentiler opencode.json içinde yapilandirilir",

  "mcp.status.connected": "bagli",
  "mcp.status.failed": "basarisiz",
  "mcp.status.needs_auth": "kimlik dogrulama gerekli",
  "mcp.auth.clickToAuthenticate": "Kimlik dogrulamak için tiklayin",
  "mcp.status.disabled": "devre disi",

  "dialog.fork.empty": "Dallandirilacak mesaj yok",

  "dialog.directory.search.placeholder": "Klasör ara",
  "dialog.directory.empty": "Klasör bulunamadi",
  "dialog.directory.action.selectFile": "Dosya seç",
  "dialog.directory.action.selectFolder": "Klasör seç",
  "dialog.directory.root": "Kök",
  "dialog.directory.parent": "Üst klasör",
  "dialog.directory.readError": "Bu klasör okunamiyor",

  "dialog.server.title": "Sunucular",
  "dialog.server.description": "Bu uygulamanin hangi OpenCode sunucusuna baglanacagini degistirin.",
  "dialog.server.search.placeholder": "Sunucu ara",
  "dialog.server.empty": "Henüz sunucu yok",
  "dialog.server.add.title": "Sunucu ekle",
  "dialog.server.add.url": "Sunucu URL'si",
  "dialog.server.add.placeholder": "http://localhost:4096",
  "dialog.server.add.error": "Sunucuya baglanilamadi",
  "dialog.server.add.checking": "Kontrol ediliyor...",
  "dialog.server.add.button": "Sunucu ekle",
  "dialog.server.add.name": "Sunucu adi (istege bagli)",
  "dialog.server.add.namePlaceholder": "Localhost",
  "dialog.server.add.username": "Kullanici adi (istege bagli)",
  "dialog.server.add.password": "Parola (istege bagli)",
  "dialog.server.edit.title": "Sunucuyu düzenle",
  "dialog.server.default.title": "Varsayilan sunucu",
  "dialog.server.default.description":
    "Uygulama baslatildiginda yerel sunucu baslatmak yerine bu sunucuya baglan. Yeniden baslatma gerektirir.",
  "dialog.server.default.none": "Sunucu seçilmedi",
  "dialog.server.default.set": "Mevcut sunucuyu varsayilan olarak ayarla",
  "dialog.server.default.clear": "Temizle",
  "dialog.server.action.remove": "Sunucuyu kaldir",

  "dialog.server.menu.edit": "Düzenle",
  "dialog.server.menu.rename": "Rename", // TODO: translate (auto-filled from en)
  "dialog.server.rename.title": "Rename server", // TODO: translate (auto-filled from en)
  "dialog.server.rename.placeholder": "Server name", // TODO: translate (auto-filled from en)
  "dialog.server.menu.default": "Varsayilan olarak ayarla",
  "dialog.server.menu.defaultRemove": "Varsayilani kaldir",
  "dialog.server.menu.delete": "Sil",
  "dialog.server.current": "Mevcut Sunucu",
  "dialog.server.status.default": "Varsayilan",
  "wsl.server.add": "WSL sunucusu ekle",
  "wsl.server.addShort": "WSL ekle",
  "wsl.server.label": "WSL",
  "wsl.server.menu.label": "WSL sunucusu",
  "wsl.server.retryStart": "Baslatmayi yeniden dene",
  "wsl.server.updating": "Güncelleniyor...",
  "wsl.onboarding.step.distro": "Dagitim seç",
  "wsl.onboarding.step.opencode": "OpenCode",
  "wsl.onboarding.checkingRuntime": "WSL kontrol ediliyor...",
  "wsl.onboarding.restartRequired": "WSL kurulumunu tamamlamak için Windows'un yeniden baslatilmasi gerekiyor.",
  "wsl.onboarding.ready": "WSL hazir.",
  "wsl.onboarding.required": "Devam etmek için WSL gerekli.",
  "wsl.onboarding.checkingDistros": "Dagitimlar kontrol ediliyor...",
  "wsl.onboarding.installingDistro": "{{distro}} kuruluyor...",
  "wsl.onboarding.checkingDistro": "{{distro}} kontrol ediliyor...",
  "wsl.onboarding.listingDistros": "Dagitimlar listeleniyor...",
  "wsl.onboarding.distroReady": "{{distro}} hazir.",
  "wsl.onboarding.distroNotInstalled": "{{distro}} henüz kurulu degil.",
  "wsl.onboarding.openDistroOnce": "Kurulumu tamamlamak için {{distro}} dagitimini bir kez açin.",
  "wsl.onboarding.finishingDistro": "{{distro}} kurulumu tamamlaniyor.",
  "wsl.onboarding.pickDistro": "Bir dagitim seçin veya asagidan bir dagitim kurun.",
  "wsl.onboarding.checkingOpencode": "OpenCode kontrol ediliyor...",
  "wsl.onboarding.checkingOpencodeIn": "{{distro}} içinde OpenCode kontrol ediliyor...",
  "wsl.onboarding.updatingOpencode": "OpenCode güncelleniyor...",
  "wsl.onboarding.updatingOpencodeIn": "{{distro}} içinde OpenCode güncelleniyor...",
  "wsl.onboarding.updateOpencodeIn": "{{distro}} içindeki OpenCode'u güncelleyin.",
  "wsl.onboarding.updateOpencode": "OpenCode'u güncelle",
  "wsl.onboarding.opencodeReadyIn": "{{distro}} içinde OpenCode hazir.",
  "wsl.onboarding.opencodeReady": "OpenCode hazir.",
  "wsl.onboarding.installOpencodeIn": "OpenCode'u {{distro}} içine kurun.",
  "wsl.onboarding.installOpencode": "OpenCode'u kur",
  "wsl.onboarding.chooseDistroFirst": "Önce bir dagitim seçin.",
  "wsl.onboarding.loadFailed": "WSL durumu yüklenemedi.",
  "wsl.onboarding.loading": "Yükleniyor...",
  "wsl.onboarding.installedDistros": "Kurulu dagitimlar",
  "wsl.onboarding.checkAgain": "Tekrar kontrol et",
  "wsl.onboarding.distroStatus.ready": "Hazir",
  "wsl.onboarding.distroStatus.checking": "Kontrol ediliyor...",
  "wsl.onboarding.distroStatus.opencodeMissing": "OpenCode kurulu degil",
  "wsl.onboarding.distroStatus.missingTools": "bash ve curl eksik",
  "wsl.onboarding.distroStatus.unsupported": "Desteklenmiyor · WSL 2 kullanin",
  "wsl.onboarding.needAnotherDistro": "Baska bir dagitim mi gerekiyor?",
  "wsl.onboarding.needAnotherDistroHint": "WSL katalogundan bir Linux dagitimi kurun",
  "wsl.onboarding.wslNotInstalled.title": "WSL kurulu degil",
  "wsl.onboarding.wslNotInstalled.description":
    "OpenCode'un WSL sunucusu ekleyebilmesi için önce WSL (Linux için Windows Alt Sistemi) kurulmalidir",
  "wsl.onboarding.wslUnavailable.title": "WSL kullanilamiyor",
  "wsl.onboarding.wslUnavailable.description": "OpenCode bu makinede WSL'yi dogrulayamadi.",
  "wsl.onboarding.installWsl": "WSL'yi kur",
  "wsl.onboarding.windowsRestartRequired":
    "WSL kurulumunu tamamlamak için Windows'u yeniden baslatin, ardindan OpenCode'u tekrar açin.",
  "wsl.onboarding.next": "Ileri",
  "wsl.onboarding.refresh": "Yenile",
  "wsl.onboarding.allDistrosAdded": "Kurulu tüm dagitimlar zaten eklenmis.",
  "wsl.onboarding.noDistros": "Henüz dagitim algilanmadi.",
  "wsl.onboarding.install": "Kur",
  "wsl.onboarding.installing": "Kuruluyor...",
  "wsl.onboarding.installDistro": "Dagitim kur",
  "wsl.onboarding.searchDistros": "Dagitim ara",
  "wsl.onboarding.wsl2Required": "WSL 2 gerekli.",
  "wsl.onboarding.toolsRequired": "Bu dagitim için bash ve curl gerekli.",
  "wsl.onboarding.openTerminal": "Terminali aç",
  "wsl.onboarding.path": "Yol: {{path}}",
  "wsl.onboarding.notFound": "bulunamadi",
  "wsl.onboarding.version": "Sürüm: {{version}}",
  "wsl.onboarding.unknown": "bilinmiyor",
  "wsl.onboarding.desktopVersion": "masaüstü {{version}}",
  "wsl.onboarding.versionMismatch": "Kurulu sürüm masaüstü uygulamasinin sürümüyle eslesmiyor.",
  "wsl.onboarding.adding": "Ekleniyor...",

  "help.tabs.toast.ariaLabel": "Sekmelerle tanisin. Çalismalarinizi ve etkin oturumlarinizi sekmelerle düzenleyin",
  "help.tabs.toast.dismiss": "Sekmeler bilgilerini kapat",
  "help.tabs.title": "Sekmelerle tanisin",
  "help.tabs.description": "Çalismalarinizi ve etkin oturumlarinizi sekmelerle düzenleyin",
  "help.tabs.date": "14 Temmuz",
  "help.tabs.introduction": "OpenCode Desktop artik sekmeler üzerine kurulu.",
  "help.tabs.sessions":
    "Bir sekmede yeni oturum baslatin veya projelerinizden mevcut bir oturumu açin. Yeni bir ise baslarken yeni sekme açin, isiniz bittiginde sekmeyi kapatin.",
  "help.tabs.organize":
    "Birkaç sekmeyi açik tutmak, etkin oturumlarinizi düzenlemenizi kolaylastirir. Sekmeleri açik tutmayi planliyorsaniz onlara akilda kalici adlar verin.",
  "help.tabs.home":
    "Tüm oturumlarinizi ve projelerinizi yeni Ana Sayfa ekraninda bulabilirsiniz. Bir oturum seçtiginizde oturum bir sekmede açilir.",
  "help.tabs.persistence": "Uygulamayi yeniden açtiginizda sekmeleriniz açik kalir.",
  "help.tabs.worktrees":
    "Yeni tasarim henüz Git Worktrees'i desteklemiyor; bu özellik yakinda kullanima sunulacak. Önceki düzeni kullanmaya devam etmek isterseniz Ayarlar'da düzenler arasinda geçis yapabilirsiniz. Yeni düzenin birkaç hafta içinde kalici olacagini unutmayin.",

  "dialog.project.edit.title": "Projeyi düzenle",
  "dialog.project.edit.name": "Ad",
  "dialog.project.edit.icon": "Simge",
  "dialog.project.edit.icon.alt": "Proje simgesi",
  "dialog.project.edit.icon.hint": "Tikla veya bir görsel sürükle",
  "dialog.project.edit.icon.recommended": "Önerilen: 128x128px",
  "dialog.project.edit.color": "Renk",
  "dialog.project.edit.color.select": "{{color}} rengini seç",
  "dialog.project.edit.worktree.startup": "Çalisma alani baslatma betigi",
  "dialog.project.edit.worktree.startup.description": "Yeni bir çalisma alani (worktree) olusturduktan sonra çalisir.",
  "dialog.project.edit.worktree.startup.placeholder": "örnegin bun install",

  "dialog.usageExceeded.dontShowAgain": "Bir daha gösterme",

  "context.breakdown.title": "Baglam Dökümü",
  "context.breakdown.note": 'Girdi tokenlerinin yaklasik dökümü. "Diger" araç tanimlari ve ek yükleri içerir.',
  "context.breakdown.system": "Sistem",
  "context.breakdown.user": "Kullanici",
  "context.breakdown.assistant": "Asistan",
  "context.breakdown.tool": "Araç Çagrilari",
  "context.breakdown.other": "Diger",

  "context.systemPrompt.title": "Sistem Istemi",
  "context.rawMessages.title": "Ham mesajlar",

  "context.export.session": "Oturumu disa aktar",

  "context.stats.session": "Oturum",
  "context.stats.messages": "Mesajlar",
  "context.stats.provider": "Saglayici",
  "context.stats.model": "Model",
  "context.stats.limit": "Baglam Siniri",
  "context.stats.totalTokens": "Toplam Token",
  "context.stats.usage": "Kullanim",
  "context.stats.inputTokens": "Girdi Tokenleri",
  "context.stats.outputTokens": "Çikti Tokenleri",
  "context.stats.reasoningTokens": "Akil Yürütme Tokenleri",
  "context.stats.cacheTokens": "Önbellek Tokenleri (okuma/yazma)",
  "context.stats.userMessages": "Kullanici Mesajlari",
  "context.stats.assistantMessages": "Asistan Mesajlari",
  "context.stats.totalCost": "Toplam Maliyet",
  "context.stats.sessionCreated": "Oturum Olusturma",
  "context.stats.lastActivity": "Son Etkinlik",

  "context.usage.tokens": "Tokenler",
  "context.usage.usage": "Kullanim",
  "context.usage.cost": "Maliyet",
  "context.usage.clickToView": "Baglami görüntüle",
  "context.usage.view": "Baglam kullanimini görüntüle",

  "language.en": "English",
  "language.zh": "????",
  "language.zht": "????",
  "language.ko": "???",
  "language.de": "Deutsch",
  "language.es": "Español",
  "language.fr": "Français",
  "language.da": "Dansk",
  "language.ja": "???",
  "language.pl": "Polski",
  "language.ru": "???????",
  "language.ar": "???????",
  "language.no": "Norsk",
  "language.br": "Português (Brasil)",
  "language.bs": "Bosanski",
  "language.uk": "??????????",
  "language.th": "???",
  "language.tr": "Türkçe",

  "toast.language.title": "Dil",
  "toast.language.description": "{{language}} diline geçildi",

  "toast.theme.title": "Tema degistirildi",
  "toast.scheme.title": "Renk semasi",

  "toast.workspace.enabled.title": "Çalisma alanlari etkinlestirildi",
  "toast.workspace.enabled.description": "Kenar çubugunda birden fazla çalisma agaci gösterilecek",
  "toast.workspace.disabled.title": "Çalisma alanlari devre disi birakildi",
  "toast.workspace.disabled.description": "Kenar çubugunda yalnizca ana çalisma agaci gösterilecek",

  "toast.permissions.autoaccept.on.title": "Izinler otomatik kabul ediliyor",
  "toast.permissions.autoaccept.on.description": "Izin istekleri otomatik olarak onaylanacak",
  "toast.permissions.autoaccept.off.title": "Izinleri otomatik kabul etme durduruldu",
  "toast.permissions.autoaccept.off.description": "Izin istekleri onay gerektirecek",

  "toast.model.none.title": "Model seçilmedi",
  "toast.model.none.description": "Bu oturumu özetlemek için bir saglayici baglayin",

  "toast.file.loadFailed.title": "Dosya yüklenemedi",
  "toast.file.listFailed.title": "Dosyalar listelenemedi",

  "toast.context.noLineSelection.title": "Satir seçimi yok",
  "toast.context.noLineSelection.description": "Önce bir dosya sekmesinde satir araligi seçin.",

  "toast.session.share.copyFailed.title": "URL panoya kopyalanamadi",
  "toast.session.share.success.title": "Oturum paylasildi",
  "toast.session.share.success.description": "Paylasim URL'si panoya kopyalandi!",
  "toast.session.share.failed.title": "Oturum paylasilamadi",
  "toast.session.share.failed.description": "Oturum paylasilirken bir hata olustu",

  "toast.session.unshare.success.title": "Oturum paylasimi kaldirildi",
  "toast.session.unshare.success.description": "Oturum paylasimi basariyla kaldirildi!",
  "toast.session.unshare.failed.title": "Oturum paylasimi kaldirilamadi",
  "toast.session.unshare.failed.description": "Oturum paylasimi kaldirilirken bir hata olustu",

  "toast.session.export.success.title": "Oturum disa aktarildi",
  "toast.session.export.success.description": "Oturum {{filename}} dosyasina kaydedildi",
  "toast.session.export.failed.title": "Oturum disa aktarilamadi",
  "toast.session.export.failed.description": "Oturum disa aktarilirken bir hata olustu",

  "toast.session.listFailed.title": "{{project}} için oturumlar yüklenemedi",

  "toast.update.title": "Güncelleme mevcut",
  "toast.update.description": "OpenCode'un yeni bir sürümü ({{version}}) yüklemeye hazir.",
  "toast.update.action.installRestart": "Yükle ve yeniden baslat",
  "toast.update.action.notYet": "Simdi degil",

  "error.page.title": "Bir seyler yanlis gitti",
  "error.page.description": "Uygulama yüklenirken bir hata olustu.",
  "error.page.description.localServerStartup": "Yerel sunucu baslatilirken bir hata olustu.",
  "error.page.details.label": "Hata Detaylari",
  "error.page.action.restart": "Yeniden Baslat",
  "error.page.action.report": "Hatayi Bildir",
  "error.page.action.reported": "Hata Bildirildi",
  "error.page.action.exportLogs": "Günlükleri Disa Aktar",
  "error.page.action.checking": "Kontrol ediliyor...",
  "error.page.action.checkUpdates": "Güncellemeleri kontrol et",
  "error.page.action.updateTo": "{{version}} sürümüne güncelle",
  "error.page.report.prefix": "Lütfen bu hatayi OpenCode ekibine",
  "error.page.report.discord": "Discord üzerinden bildirin",
  "error.page.version": "Sürüm: {{version}}",

  "error.dev.rootNotFound":
    "Kök eleman bulunamadi. index.html dosyaniza eklemeyi unuttunuz mu? Ya da id özelligi yanlis mi yazildi?",

  "error.serverSync.connectFailed": "Sunucuya baglanilamadi. `{{url}}` adresinde çalisan bir sunucu var mi?",
  "directory.error.invalidUrl": "URL'de geçersiz dizin.",

  "error.chain.unknown": "Bilinmeyen hata",
  "error.chain.causedBy": "Nedeni:",
  "error.chain.apiError": "API hatasi",
  "error.chain.status": "Durum: {{status}}",
  "error.chain.retryable": "Yeniden denenebilir: {{retryable}}",
  "error.chain.responseBody": "Yanit gövdesi:\n{{body}}",
  "error.chain.didYouMean": "Bunu mu demek istediniz: {{suggestions}}",
  "error.chain.modelNotFound": "Model bulunamadi: {{provider}}/{{model}}",
  "error.chain.checkConfig": "Yapilandirma dosyanizdaki (opencode.json) saglayici/model adlarini kontrol edin",
  "error.chain.mcpFailed":
    'MCP sunucusu "{{name}}" çalistirilamadi. Not: OpenCode henüz MCP kimlik dogrulamasini desteklemiyor.',
  "error.chain.providerAuthFailed": "Saglayici kimlik dogrulamasi basarisiz ({{provider}}): {{message}}",
  "error.chain.providerInitFailed":
    '"{{provider}}" saglayicisi baslatilamadi. Kimlik bilgilerini ve yapilandirmayi kontrol edin.',
  "error.chain.configJsonInvalid": "{{path}} adresindeki yapilandirma dosyasi geçerli JSON(C) degil",
  "error.chain.configJsonInvalidWithMessage":
    "{{path}} adresindeki yapilandirma dosyasi geçerli JSON(C) degil: {{message}}",
  "error.chain.configDirectoryTypo":
    '"{{dir}}" dizini {{path}} içinde geçerli degil. Dizini "{{suggestion}}" olarak yeniden adlandirin veya kaldirin. Bu yaygin bir yazim hatasidir.',
  "error.chain.configFrontmatterError": "{{path}} içindeki ön bilgi ayristirilamadi:\n{{message}}",
  "error.chain.configInvalid": "{{path}} adresindeki yapilandirma dosyasi geçersiz",
  "error.chain.configInvalidWithMessage": "{{path}} adresindeki yapilandirma dosyasi geçersiz: {{message}}",

  "notification.permission.title": "Izin gerekli",
  "notification.permission.description": "{{projectName}} içindeki {{sessionTitle}} izin gerektiriyor",
  "notification.question.title": "Soru",
  "notification.question.description": "{{projectName}} içindeki {{sessionTitle}} bir soru soruyor",
  "notification.action.goToSession": "Oturuma git",

  "notification.session.responseReady.title": "Yanit hazir",
  "notification.session.error.title": "Oturum hatasi",
  "notification.session.error.fallbackDescription": "Bir hata olustu",

  "home.recentProjects": "Son projeler",
  "home.empty.title": "Son proje yok",
  "home.empty.description": "Yerel bir proje açarak baslayin",
  "home.title": "Ana Sayfa",
  "home.projects": "Projeler",
  "home.project.add": "Proje ekle",
  "home.recentlyClosed": "Yakin zamanda kapatilanlar",
  "home.server.collapse": "Sunucu projelerini daralt",
  "home.server.expand": "Sunucu projelerini genislet",
  "home.sessions.search.placeholder": "Oturum ara",
  "home.sessions.search.placeholder.scoped": "{{scope}} kapsaminda oturum ara",
  "home.sessions.search.sessions": "Oturumlar",
  "home.sessions.search.noResults": "{{query}} için oturum bulunamadi",
  "home.sessions.empty": "Henüz burada bir sey yok",
  "home.sessions.empty.description": "Baslamak için bir oturum olusturun",
  "home.sessions.group.today": "Bugün",
  "home.sessions.group.yesterday": "Dün",
  "home.sessions.group.older": "Daha eski",
  "home.providerTip": "Claude, GPT, Gemini ve diger modelleri kullanmak için 75'ten fazla saglayiciya baglanin",

  "session.tab.session": "Oturum",
  "session.tab.review": "Inceleme",
  "session.tab.context": "Baglam",
  "session.tab.unknown": "Bilinmeyen Oturum",
  "session.panel.reviewAndFiles": "Inceleme ve dosyalar",
  "session.error.notFound": "Bu oturum bulunamiyor",
  "session.error.notFound.description": "Bu sekme, artik bu sunucuda bulunmayan bir oturuma yönlendiriyor.",
  "session.error.notFound.closeTab": "Sekmeyi kapat",
  "session.error.serverConnection": "Bu sunucuya baglanilamiyor",
  "session.review.filesChanged": "{{count}} dosya degisti",
  "session.review.change.one": "Degisiklik",
  "session.review.change.other": "Degisiklik",
  "session.review.loadingChanges": "Degisiklikler yükleniyor...",
  "session.review.empty": "Bu oturumda henüz degisiklik yok",
  "session.review.noVcs": "Git VCS algilanamadi, oturum degisiklikleri tespit edilemeyecek",
  "session.review.noSnapshot":
    "Yapilandirmada anlik görüntü takibi devre disi birakildi, bu nedenle oturum degisiklikleri kullanilamiyor",
  "session.review.noChanges": "Degisiklik yok",
  "session.review.noUncommittedChanges": "Henüz islenmemis degisiklik yok",
  "session.review.noBranchChanges": "Henüz dal degisikligi yok",

  "session.files.selectToOpen": "Açmak için bir dosya seçin",
  "session.files.all": "Tüm dosyalar",
  "session.files.empty": "Dosya yok",
  "session.files.binaryContent": "Ikili dosya (içerik görüntülenemiyor)",

  "session.messages.renderEarlier": "Önceki mesajlari göster",
  "session.messages.loadingEarlier": "Önceki mesajlar yükleniyor...",
  "session.messages.loadEarlier": "Önceki mesajlari yükle",
  "session.messages.loading": "Mesajlar yükleniyor...",
  "session.messages.jumpToLatest": "En sona atla",

  "session.context.addToContext": "{{selection}} baglama ekle",
  "session.todo.title": "Görevler",
  "session.todo.collapse": "Daralt",
  "session.todo.expand": "Genislet",
  "session.question.minimize": "Soruyu küçült",
  "session.question.restore": "Soruyu geri yükle",
  "session.question.pending.one": "{{count}} bekleyen soru",
  "session.question.pending.other": "{{count}} bekleyen soru",
  "session.followupDock.summary.one": "{{count}} siradaki mesaj",
  "session.followupDock.summary.other": "{{count}} siradaki mesaj",
  "session.followupDock.sendNow": "Simdi gönder",
  "session.followupDock.edit": "Düzenle",
  "session.followupDock.collapse": "Siradaki mesajlari daralt",
  "session.followupDock.expand": "Siradaki mesajlari genislet",
  "session.revertDock.summary.one": "{{count}} geri alinan mesaj",
  "session.revertDock.summary.other": "{{count}} geri alinan mesaj",
  "session.revertDock.collapse": "Geri alinan mesajlari daralt",
  "session.revertDock.expand": "Geri alinan mesajlari genislet",
  "session.revertDock.restore": "Mesaji geri yükle",

  "session.new.title": "Her seyi gelistirin",
  "session.new.project.new": "Yeni proje",
  "session.new.project.search": "Proje ara",
  "session.new.project.add": "Proje ekle",
  "session.new.worktree.main": "Ana dal",
  "session.new.worktree.mainWithBranch": "Ana dal ({{branch}})",
  "session.new.worktree.create": "Yeni çalisma agaci olustur",
  "session.new.workspace.runIn": "Oturumu surada çalistir",
  "session.new.workspace.triggerLocal": "Yerel",
  "session.new.workspace.local": "Yerel depo",
  "session.new.workspace.existing": "Çalisma alani…",
  "session.new.git.none": "Git yok",
  "session.git.switchBranch": "Switch branch",
  "session.git.branches": "Git branches",
  "session.git.checkoutFailed": "Failed to switch branch",
  "session.git.switchConfirmTitle": "Switch branch?",
  "session.git.switchConfirmDesc": "You have uncommitted changes. Switching to '{{branch}}' might fail or carry these changes over.",
  "session.git.switchConfirmButton": "Switch anyway",
  "session.git.activeSessionWarn": "Active session running on this branch",
  "session.new.worktree.isolatedToggle": "Create in isolated worktree",
  "session.new.lastModified": "Son degisiklik",

  "session.header.search.placeholder": "{{project}} ara",
  "session.header.searchFiles": "Dosya ara",
  "session.header.openIn": "Aç",
  "session.header.open.action": "{{app}} ile aç",
  "session.header.open.ariaLabel": "{{app}} ile aç",
  "session.header.open.menu": "Açma seçenekleri",
  "session.header.open.copyPath": "Yolu kopyala",
  "session.header.reveal.finder": "Finder'da göster",
  "session.header.reveal.fileExplorer": "Dosya Gezgini'nde göster",
  "session.header.reveal.containingFolder": "Içeren klasörü aç",

  "status.popover.trigger": "Durum",
  "status.popover.ariaLabel": "Sunucu yapilandirmalari",
  "status.popover.tab.servers": "Sunucular",
  "status.popover.tab.mcp": "MCP",
  "status.popover.tab.lsp": "LSP",
  "status.popover.tab.plugins": "Eklentiler",
  "status.popover.action.manageServers": "Sunuculari yönet",

  "session.share.popover.title": "Web'de yayinla",
  "session.share.popover.description.shared": "Bu oturum web'de herkese açiktir. Baglantiya sahip herkes erisebilir.",
  "session.share.popover.description.unshared":
    "Oturumu web'de herkese açik olarak paylasin. Baglantiya sahip herkes erisebilecek.",
  "session.share.action.share": "Paylas",
  "session.share.action.publish": "Yayinla",
  "session.share.action.publishing": "Yayinlaniyor...",
  "session.share.action.unpublish": "Yayindan kaldir",
  "session.share.action.unpublishing": "Yayindan kaldiriliyor...",
  "session.share.action.view": "Görüntüle",
  "session.share.copy.copied": "Kopyalandi",
  "session.share.copy.copyLink": "Baglantiyi kopyala",

  "lsp.tooltip.none": "LSP sunucusu yok",
  "lsp.label.connected": "{{count}} LSP",

  "prompt.loading": "Istem yükleniyor...",
  "terminal.loading": "Terminal yükleniyor...",
  "terminal.title": "Terminal",
  "terminal.title.numbered": "Terminal {{number}}",
  "terminal.close": "Terminali kapat",
  "terminal.connectionLost.title": "Baglanti kesildi",
  "terminal.connectionLost.description":
    "Terminal baglantisi kesildi. Bu durum sunucu yeniden basladiginda olusabilir.",
  "terminal.connectTicket.csrfError":
    "PTY baglanti bileti, kaynak veya CSRF denetimleri tarafindan reddedildi. Sunucunun CORS yapilandirmasini kontrol edin.",
  "terminal.connectTicket.statusError": "PTY baglanti bileti {{status}} durumuyla basarisiz oldu",

  "titlebar.update": "Güncelle",
  "titlebar.updateVersion": "Güncelle {{version}}",

  "common.closeTab": "Sekmeyi kapat",
  "common.dismiss": "Kapat",
  "common.requestFailed": "Istek basarisiz",
  "common.optional": "istege bagli",
  "common.moreOptions": "Daha fazla seçenek",
  "common.learnMore": "Daha fazla bilgi",
  "common.rename": "Yeniden adlandir",
  "common.export": "Disa aktar",
  "common.reset": "Sifirla",
  "common.archive": "Arsivle",
  "common.delete": "Sil",
  "common.close": "Kapat",
  "common.edit": "Düzenle",
  "common.loadMore": "Daha fazla yükle",
  "common.key.esc": "ESC",

  "sidebar.menu.toggle": "Menüyü aç/kapat",
  "sidebar.nav.projectsAndSessions": "Projeler ve oturumlar",
  "sidebar.settings": "Ayarlar",
  "sidebar.help": "Yardim",
  "sidebar.workspaces.enable": "Çalisma alanlarini etkinlestir",
  "sidebar.workspaces.disable": "Çalisma alanlarini devre disi birak",
  "sidebar.gettingStarted.title": "Baslarken",
  "sidebar.gettingStarted.line1": "OpenCode ücretsiz modeller içerir, böylece hemen baslayabilirsiniz.",
  "sidebar.gettingStarted.line2": "Claude, GPT, Gemini vb. modelleri kullanmak için herhangi bir saglayici baglayin.",
  "sidebar.project.recentSessions": "Son oturumlar",
  "sidebar.project.viewAllSessions": "Tüm oturumlari görüntüle",
  "sidebar.project.clearNotifications": "Bildirimleri temizle",
  "sidebar.empty.title": "Açik proje yok",
  "sidebar.empty.description": "Baslamak için bir proje açin",

  "app.name.desktop": "OpenCode Masaüstü",

  "settings.section.desktop": "Masaüstü",
  "settings.section.server": "Sunucu",
  "settings.tab.general": "Genel",
  "settings.tab.shortcuts": "Kisayollar",
  "settings.desktop.section.wsl": "WSL",
  "settings.desktop.wsl.title": "WSL entegrasyonu",
  "settings.desktop.wsl.description": "OpenCode sunucusunu Windows'ta WSL içinde çalistirin.",

  "settings.general.section.appearance": "Görünüm",
  "settings.general.section.advanced": "Gelismis",
  "settings.general.section.notifications": "Sistem bildirimleri",
  "settings.general.section.updates": "Güncellemeler",
  "settings.general.section.sounds": "Ses efektleri",
  "settings.general.section.feed": "Akis",
  "settings.general.section.display": "Ekran",

  "settings.general.row.language.title": "Dil",
  "settings.general.row.language.description": "OpenCode'un görünüm dilini degistirin",
  "settings.general.row.shell.title": "Terminal Kabugu",
  "settings.general.row.shell.description":
    "Terminalinizde kullanilacak kabugu seçin. Uyumlu kabuklar, ajan araç çagrilarinda da kullanilir.",
  "settings.general.row.shell.autoDefault": "Otomatik (Varsayilan)",
  "settings.general.row.shell.terminalOnly": "yalnizca terminal",
  "settings.general.row.appearance.title": "Görünüm",
  "settings.general.row.appearance.description": "OpenCode'un cihazinizdaki görünümünü özellestirin",
  "settings.general.row.colorScheme.title": "Renk semasi",
  "settings.general.row.colorScheme.description":
    "OpenCode'un sistem, açik veya koyu temayi takip etip etmeyecegini seçin",
  "settings.general.row.theme.title": "Tema",
  "settings.general.row.theme.description": "OpenCode'un temasini özellestirin.",
  "settings.general.row.font.title": "Kod yazi tipi",
  "settings.general.row.font.description": "Kod bloklarinda kullanilan yazi tipini özellestirin",
  "settings.general.row.terminalFont.title": "Terminal yazi tipi",
  "settings.general.row.terminalFont.description": "Terminalde kullanilan yazi tipini özellestirin",
  "settings.general.row.uiFont.title": "Arayüz yazi tipi",
  "settings.general.row.uiFont.description": "Arayüz genelinde kullanilan yazi tipini özellestirin",
  "settings.general.row.followup.title": "Takip davranisi",
  "settings.general.row.followup.description":
    "Takip istemlerinin hemen yönlendirilmesini mi yoksa sirada beklemesini mi istediginizi seçin",
  "settings.general.row.followup.option.queue": "Sira",
  "settings.general.row.followup.option.steer": "Yönlendir",
  "settings.general.row.showFileTree.title": "Dosya agaci",
  "settings.general.row.showFileTree.description": "Oturumlarda dosya agaci panelini göster",
  "settings.general.row.showNavigation.title": "Gezinme denetimleri",
  "settings.general.row.showNavigation.description": "Masaüstü baslik çubugunda geri ve ileri dügmelerini göster",
  "settings.general.row.showSearch.title": "Komut paleti",
  "settings.general.row.showSearch.description": "Baslik çubugunda arama ve komut paleti dügmesini göster",
  "settings.general.row.showTerminal.title": "Terminal",
  "settings.general.row.showTerminal.description": "Masaüstü baslik çubugunda terminal dügmesini göster",
  "settings.general.row.showStatus.title": "Sunucu durumu",
  "settings.general.row.showStatus.description": "Baslik çubugunda sunucu durumu dügmesini göster",
  "settings.general.row.mobileTitlebarBottom.title": "Alt gezinme",
  "settings.general.row.mobileTitlebarBottom.description":
    "Mobil cihazlarda baslik çubugunu ve oturum sekmelerini ekranin altina yerlestir",
  "settings.general.row.showCustomAgents.title": "Ajani göster",
  "settings.general.row.showCustomAgents.description":
    "Düzenleyicide ajanlar arasinda geçis yapin. Gizlendiginde varsayilan olarak Build ajani kullanilir.",
  "settings.general.row.reasoningSummaries.title": "Akil yürütme özetlerini göster",
  "settings.general.row.reasoningSummaries.description": "Zaman çizelgesinde model akil yürütme özetlerini görüntüle",
  "settings.general.row.shellToolPartsExpanded.title": "Kabuk araç bilesenlerini genislet",
  "settings.general.row.shellToolPartsExpanded.description":
    "Zaman çizelgesinde kabuk araç bilesenlerini varsayilan olarak genisletilmis göster",
  "settings.general.row.editToolPartsExpanded.title": "Düzenleme araç bilesenlerini genislet",
  "settings.general.row.editToolPartsExpanded.description":
    "Zaman çizelgesinde düzenleme, yazma ve yama araç bilesenlerini varsayilan olarak genisletilmis göster",
  "settings.general.row.newInterface.title": "Yeni düzen",
  "settings.general.row.newInterface.badge": "Yeni",
  "settings.general.row.newInterface.description":
    "Yeni sekmeleri ve ana sayfa düzenini kullanin. Sinirli bir süre boyunca düzenler arasinda geçis yapabilirsiniz.",
  "settings.general.row.newInterfaceNotice.title": "Artik yeni düzeni kullaniyorsunuz",
  "settings.general.row.newInterfaceNotice.description": "Önceki düzen artik kullanilamiyor",
  "settings.general.row.newInterfaceNotice.dismiss": "Kapat",
  "settings.general.row.pinchZoom.title": "Sikistirarak yakinlastir",
  "settings.general.row.pinchZoom.description":
    "Izleme dörtgeninde sikistirma ve Ctrl-kaydirma hareketleriyle yakinlastirmaya izin ver",

  "settings.general.row.wayland.title": "Yerel Wayland kullan",
  "settings.general.row.wayland.description":
    "Wayland'da X11 geri dönüsünü devre disi birak. Yeniden baslatma gerektirir.",
  "settings.general.row.wayland.tooltip":
    "Farkli yenileme hizlarina sahip monitörlerin kullanildigi Linux sistemlerinde yerel Wayland daha kararli olabilir.",

  "settings.general.row.releaseNotes.title": "Sürüm notlari",
  "settings.general.row.releaseNotes.description": "Güncellemelerden sonra Yenilikler bildirimlerini göster",

  "settings.updates.row.startup.title": "Baslangiçta güncellemeleri kontrol et",
  "settings.updates.row.startup.description": "OpenCode basladiginda otomatik güncelleme kontrolü yap",
  "settings.updates.row.check.title": "Güncellemeleri kontrol et",
  "settings.updates.row.check.description": "Elle güncelleme kontrolü yap ve varsa yükle",
  "settings.updates.action.checkNow": "Simdi kontrol et",
  "settings.updates.action.checking": "Kontrol ediliyor...",
  "settings.updates.action.downloading": "Indiriliyor...",
  "settings.updates.action.installing": "Kuruluyor...",
  "settings.updates.toast.latest.title": "Güncelsiniz",
  "settings.updates.toast.latest.description": "OpenCode'un en son sürümünü kullaniyorsunuz.",

  "sound.option.none": "Yok",
  "sound.option.alert01": "Uyari 01",
  "sound.option.alert02": "Uyari 02",
  "sound.option.alert03": "Uyari 03",
  "sound.option.alert04": "Uyari 04",
  "sound.option.alert05": "Uyari 05",
  "sound.option.alert06": "Uyari 06",
  "sound.option.alert07": "Uyari 07",
  "sound.option.alert08": "Uyari 08",
  "sound.option.alert09": "Uyari 09",
  "sound.option.alert10": "Uyari 10",
  "sound.option.bipbop01": "Bip-bop 01",
  "sound.option.bipbop02": "Bip-bop 02",
  "sound.option.bipbop03": "Bip-bop 03",
  "sound.option.bipbop04": "Bip-bop 04",
  "sound.option.bipbop05": "Bip-bop 05",
  "sound.option.bipbop06": "Bip-bop 06",
  "sound.option.bipbop07": "Bip-bop 07",
  "sound.option.bipbop08": "Bip-bop 08",
  "sound.option.bipbop09": "Bip-bop 09",
  "sound.option.bipbop10": "Bip-bop 10",
  "sound.option.staplebops01": "Staplebops 01",
  "sound.option.staplebops02": "Staplebops 02",
  "sound.option.staplebops03": "Staplebops 03",
  "sound.option.staplebops04": "Staplebops 04",
  "sound.option.staplebops05": "Staplebops 05",
  "sound.option.staplebops06": "Staplebops 06",
  "sound.option.staplebops07": "Staplebops 07",
  "sound.option.nope01": "Hayir 01",
  "sound.option.nope02": "Hayir 02",
  "sound.option.nope03": "Hayir 03",
  "sound.option.nope04": "Hayir 04",
  "sound.option.nope05": "Hayir 05",
  "sound.option.nope06": "Hayir 06",
  "sound.option.nope07": "Hayir 07",
  "sound.option.nope08": "Hayir 08",
  "sound.option.nope09": "Hayir 09",
  "sound.option.nope10": "Hayir 10",
  "sound.option.nope11": "Hayir 11",
  "sound.option.nope12": "Hayir 12",
  "sound.option.yup01": "Evet 01",
  "sound.option.yup02": "Evet 02",
  "sound.option.yup03": "Evet 03",
  "sound.option.yup04": "Evet 04",
  "sound.option.yup05": "Evet 05",
  "sound.option.yup06": "Evet 06",

  "settings.general.notifications.agent.title": "Ajan",
  "settings.general.notifications.agent.description":
    "Ajan tamamlandiginda veya dikkat gerektirdiginde sistem bildirimi göster",
  "settings.general.notifications.permissions.title": "Izinler",
  "settings.general.notifications.permissions.description": "Izin gerektiginde sistem bildirimi göster",
  "settings.general.notifications.errors.title": "Hatalar",
  "settings.general.notifications.errors.description": "Hata olustugunda sistem bildirimi göster",

  "settings.general.sounds.agent.title": "Ajan",
  "settings.general.sounds.agent.description": "Ajan tamamlandiginda veya dikkat gerektirdiginde ses çal",
  "settings.general.sounds.permissions.title": "Izinler",
  "settings.general.sounds.permissions.description": "Izin gerektiginde ses çal",
  "settings.general.sounds.errors.title": "Hatalar",
  "settings.general.sounds.errors.description": "Hata olustugunda ses çal",

  "settings.shortcuts.title": "Klavye kisayollari",
  "settings.shortcuts.reset.button": "Varsayilanlara sifirla",
  "settings.shortcuts.reset.toast.title": "Kisayollar sifirlandi",
  "settings.shortcuts.reset.toast.description": "Klavye kisayollari varsayilanlara sifirlandi.",
  "settings.shortcuts.conflict.title": "Kisayol zaten kullaniliyor",
  "settings.shortcuts.conflict.description": "{{keybind}} zaten {{titles}} için atanmis.",
  "settings.shortcuts.unassigned": "Atanmamis",
  "settings.shortcuts.pressKeys": "Tuslara basin",
  "settings.shortcuts.search.placeholder": "Kisayol ara",
  "settings.shortcuts.search.empty": "Kisayol bulunamadi",

  "settings.shortcuts.group.general": "Genel",
  "settings.shortcuts.group.session": "Oturum",
  "settings.shortcuts.group.navigation": "Gezinme",
  "settings.shortcuts.group.modelAndAgent": "Model ve ajan",
  "settings.shortcuts.group.terminal": "Terminal",
  "settings.shortcuts.group.prompt": "Istem",

  "settings.providers.title": "Saglayicilar",
  "settings.providers.description": "Saglayici ayarlari burada yapilandirilabilecek.",
  "settings.providers.section.connected": "Bagli saglayicilar",
  "settings.providers.connected.empty": "Bagli saglayici yok",
  "settings.providers.section.popular": "Popüler saglayicilar",
  "settings.providers.tag.environment": "Ortam",
  "settings.providers.tag.config": "Yapilandirma",
  "settings.providers.tag.custom": "Özel",
  "settings.providers.tag.other": "Diger",
  "settings.models.title": "Modeller",
  "settings.models.description": "Model ayarlari burada yapilandirilabilecek.",
  "settings.agents.title": "Ajanlar",
  "settings.agents.description": "Ajan ayarlari burada yapilandirilabilecek.",
  "settings.commands.title": "Komutlar",
  "settings.commands.description": "Komut ayarlari burada yapilandirilabilecek.",
  "settings.mcp.title": "MCP",
  "settings.mcp.description": "MCP ayarlari burada yapilandirilabilecek.",

  "settings.permissions.title": "Izinler",
  "settings.permissions.description": "Sunucunun varsayilan olarak hangi araçlari kullanabilecegini kontrol edin.",
  "settings.permissions.section.tools": "Araçlar",
  "settings.permissions.toast.updateFailed.title": "Izinler güncellenemedi",

  "settings.permissions.action.allow": "Izin ver",
  "settings.permissions.action.ask": "Sor",
  "settings.permissions.action.deny": "Reddet",

  "settings.permissions.tool.read.title": "Oku",
  "settings.permissions.tool.read.description": "Bir dosyayi okuma (dosya yoluyla eslesir)",
  "settings.permissions.tool.edit.title": "Düzenle",
  "settings.permissions.tool.edit.description": "Düzenleme, yazma, yama ve çoklu düzenleme dahil dosyalari degistir",
  "settings.permissions.tool.glob.title": "Glob",
  "settings.permissions.tool.glob.description": "Glob kaliplari kullanarak dosyalari esle",
  "settings.permissions.tool.grep.title": "Grep",
  "settings.permissions.tool.grep.description": "Düzenli ifadeler kullanarak dosya içerikleri ara",
  "settings.permissions.tool.list.title": "Listele",
  "settings.permissions.tool.list.description": "Bir dizindeki dosyalari listele",
  "settings.permissions.tool.bash.title": "Bash",
  "settings.permissions.tool.bash.description": "Kabuk komutlari çalistir",
  "settings.permissions.tool.task.title": "Görev",
  "settings.permissions.tool.task.description": "Alt ajanlar baslat",
  "settings.permissions.tool.skill.title": "Beceri",
  "settings.permissions.tool.skill.description": "Ada göre bir beceri yükle",
  "settings.permissions.tool.lsp.title": "LSP",
  "settings.permissions.tool.lsp.description": "Dil sunucusu sorgulari çalistir",
  "settings.permissions.tool.todowrite.title": "Görev Yaz",
  "settings.permissions.tool.todowrite.description": "Görev listesini güncelle",
  "settings.permissions.tool.webfetch.title": "Web Getir",
  "settings.permissions.tool.webfetch.description": "Bir URL'den içerik getir",
  "settings.permissions.tool.websearch.title": "Web Ara",
  "settings.permissions.tool.websearch.description": "Web'de ara",
  "settings.permissions.tool.external_directory.title": "Harici Dizin",
  "settings.permissions.tool.external_directory.description": "Proje dizini disindaki dosyalara eris",
  "settings.permissions.tool.doom_loop.title": "Sonsuz Döngü",
  "settings.permissions.tool.doom_loop.description": "Ayni girdiyle tekrarlanan araç çagrilarini algila",

  "session.delete.failed.title": "Oturum silinemedi",
  "session.delete.title": "Oturumu sil",
  "session.delete.confirm": '"{{name}}" oturumu silinsin mi?',
  "session.delete.button": "Oturumu sil",

  "workspace.new": "Yeni çalisma alani",
  "workspace.type.local": "yerel",
  "workspace.type.sandbox": "korumali alan",
  "workspace.create.failed.title": "Çalisma alani olusturulamadi",
  "workspace.delete.failed.title": "Çalisma alani silinemedi",
  "workspace.resetting.title": "Çalisma alani sifirlaniyor",
  "workspace.resetting.description": "Bu bir dakika sürebilir.",
  "workspace.reset.failed.title": "Çalisma alani sifirlanamadi",
  "workspace.reset.success.title": "Çalisma alani sifirlandi",
  "workspace.reset.success.description": "Çalisma alani artik varsayilan dalla eslesiyor.",
  "workspace.error.stillPreparing": "Çalisma alani hâlâ hazirlaniyor",
  "workspace.status.checking": "Birlesmemis degisiklikler kontrol ediliyor...",
  "workspace.status.error": "Git durumu dogrulanamadi.",
  "workspace.status.clean": "Birlesmemis degisiklik algilanmadi.",
  "workspace.status.dirty": "Bu çalisma alaninda birlesmemis degisiklikler algilandi.",
  "workspace.delete.title": "Çalisma alanini sil",
  "workspace.delete.confirm": '"{{name}}" çalisma alani silinsin mi?',
  "workspace.delete.button": "Çalisma alanini sil",
  "workspace.reset.title": "Çalisma alanini sifirla",
  "workspace.reset.confirm": '"{{name}}" çalisma alani sifirlansin mi?',
  "workspace.reset.button": "Çalisma alanini sifirla",
  "workspace.reset.archived.none": "Arsivlenecek aktif oturum yok.",
  "workspace.reset.archived.one": "1 oturum arsivlenecek.",
  "workspace.reset.archived.many": "{{count}} oturum arsivlenecek.",
  "workspace.reset.note": "Bu islem çalisma alanini varsayilan dalla eslesecek sekilde sifirlayacak.",
  "common.open": "Aç",
  "dialog.releaseNotes.action.getStarted": "Basla",
  "dialog.releaseNotes.action.next": "Ileri",
  "dialog.releaseNotes.action.hideFuture": "Bunu gelecekte bir daha gösterme",
  "dialog.releaseNotes.media.alt": "Sürüm önizlemesi",
  "toast.project.reloadFailed.title": "{{project}} yeniden yüklenemedi",
  "error.server.invalidConfiguration": "Geçersiz yapilandirma",
  "common.moreCountSuffix": " (+{{count}} daha)",
  "common.time.justNow": "Simdi",
  "common.time.minutesAgo.short": "{{count}} dk önce",
  "common.time.hoursAgo.short": "{{count}} sa önce",
  "common.time.daysAgo.short": "{{count}} gün önce",
  "settings.providers.connected.environmentDescription": "Ortam degiskenlerinizden baglandi",
  "settings.providers.custom.description": "Temel URL üzerinden OpenAI uyumlu bir saglayici ekleyin.",

  "app.server.unreachable": "{{server}} sunucusuna ulasilamadi",
  "app.server.retrying": "Otomatik olarak tekrar deneniyor...",
  "app.server.otherServers": "Diger sunucular",
  "dialog.server.add.usernamePlaceholder": "kullanici adi",
  "dialog.server.add.passwordPlaceholder": "parola",
  "server.row.noUsername": "kullanici adi yok",
  "session.review.noVcs.createGit.title": "Git deposu olustur",
  "session.review.noVcs.createGit.description": "Bu projedeki degisiklikleri takip et, incele ve geri al",
  "session.review.noVcs.createGit.actionLoading": "Git deposu olusturuluyor...",
  "session.review.noVcs.createGit.action": "Git deposu olustur",
  "session.todo.progress": "{{total}} görevin {{done}} tanesi tamamlandi",
  "session.question.progress": "{{total}} sorunun {{current}} tanesi",
  "session.header.open.finder": "Finder",
  "session.header.open.fileExplorer": "Dosya Gezgini",
  "session.header.open.fileManager": "Dosya Yöneticisi",
  "session.header.open.app.vscode": "VS Code",
  "session.header.open.app.cursor": "Cursor",
  "session.header.open.app.zed": "Zed",
  "session.header.open.app.textmate": "TextMate",
  "session.header.open.app.antigravity": "Antigravity",
  "session.header.open.app.terminal": "Terminal",
  "session.header.open.app.iterm2": "iTerm2",
  "session.header.open.app.ghostty": "Ghostty",
  "session.header.open.app.warp": "Warp",
  "session.header.open.app.xcode": "Xcode",
  "session.header.open.app.androidStudio": "Android Studio",
  "session.header.open.app.powershell": "PowerShell",
  "session.header.open.app.sublimeText": "Sublime Text",
  "debugBar.ariaLabel": "Gelistirme performansi teshisi",
  "debugBar.na": "yok",
  "debugBar.nav.label": "NAV",
  "debugBar.nav.tip":
    "Yönlendirici baslangicindan yerlesme sonrasi ilk boyamaya kadar ölçülen, bir oturum sayfasina dokunan son tamamlanmis rota geçisi.",
  "debugBar.fps.label": "FPS",
  "debugBar.fps.tip": "Son 5 saniyedeki hareketli saniye basina kare ortalamasi.",
  "debugBar.frame.label": "FRAME",
  "debugBar.frame.tip": "Son 5 saniyedeki en kötü kare süresi.",
  "debugBar.jank.label": "JANK",
  "debugBar.jank.tip": "Son 5 saniyede 32ms üzerindeki kareler.",
  "debugBar.long.label": "LONG",
  "debugBar.long.tip": "Son 5 saniyedeki engellenen süre ve uzun görev sayisi. Maksimum görev: {{max}}.",
  "debugBar.delay.label": "DELAY",
  "debugBar.delay.tip": "Son 5 saniyede gözlemlenen en kötü giris gecikmesi.",
  "debugBar.inp.label": "INP",
  "debugBar.inp.tip": "Son 5 saniyedeki yaklasik etkilesim süresi. Bu INP benzeridir, resmi Web Vitals INP degildir.",
  "debugBar.cls.label": "CLS",
  "debugBar.cls.tip": "Mevcut uygulama ömrü için kümülatif düzen kaymasi.",
  "debugBar.mem.label": "MEM",
  "debugBar.mem.tipUnavailable": "Kullanilan JS yigininin yigin sinirina orani. Yalnizca Chromium.",
  "debugBar.mem.tip": "Kullanilan JS yigininin yigin sinirina orani: {{used}} / {{limit}}.",
  "debugBar.focus.label": "FOCUS",
  "debugBar.focus.tip": "Tüm etkilesimli ögelere odak stillerini zorla uygula",
  "debugBar.focus.on": "AÇIK",
  "debugBar.focus.off": "KAPALI",
  "debugBar.direction.label": "DIR",
  "debugBar.direction.tip": "Seçili dili degistirmeden tüm uygulamanin düzen yönünü zorla ayarla",
  "debugBar.direction.ltr": "LTR",
  "debugBar.direction.rtl": "RTL",
  "common.key.ctrl": "Ctrl",
  "common.key.alt": "Alt",
  "common.key.shift": "Shift",
  "common.key.meta": "Meta",
  "common.key.space": "Bosluk",
  "common.key.backspace": "Geri Al",
  "common.key.enter": "Enter",
  "common.key.tab": "Tab",
  "common.key.delete": "Delete",
  "common.key.home": "Home",
  "common.key.end": "End",
  "common.key.pageUp": "Page Up",
  "common.key.pageDown": "Page Down",
  "common.key.insert": "Insert",
  "common.unknown": "bilinmiyor",
  "error.page.circular": "[Döngüsel]",
  "error.serverSDK.noServerAvailable": "Sunucu yok",
  "error.serverSDK.serverNotAvailable": "Sunucu mevcut degil",
  "error.childStore.persistedCacheCreateFailed": "Kalici önbellek olusturulamadi",
  "error.childStore.persistedProjectMetadataCreateFailed": "Kalici proje meta verileri olusturulamadi",
  "error.childStore.persistedProjectIconCreateFailed": "Kalici proje simgesi olusturulamadi",
  "error.childStore.storeCreateFailed": "Depo olusturulamadi",
  "terminal.connectionLost.abnormalClose": "WebSocket anormal sekilde kapandi: {{code}}",
  "dialog.provider.omniroute.note": "Bring your own gateway URL and key, all models imported automatically",
  "dialog.model.selectProvider.title": "Select provider",
  "dialog.model.provider.label": "Provider",
  "prompt.mode.select.title": "Select mode",
  "prompt.mode.auto.label": "Automatic",
  "prompt.mode.auto.description": "Automatically manages permission decisions",
  "prompt.mode.manual.label": "Manual",
  "prompt.mode.manual.description": "Always ask before making changes",
  "prompt.mode.edits.label": "Accept edits",
  "prompt.mode.edits.description": "Automatically accept all file edits",
  "prompt.mode.plan.label": "Plan",
  "prompt.mode.plan.description": "Create a plan before making changes",
  "prompt.mode.bypass.label": "Bypass permissions",
  "prompt.mode.bypass.description": "Accept all permissions for this directory",
  "prompt.mode.group.directory": "This directory",
  "provider.omniroute.title": "Connect Omniroute",
  "provider.omniroute.description": "Enter your Omniroute gateway URL and API key. All available models are imported automatically and organized by category.",
  "provider.omniroute.importing": "Importing models...",
  "provider.omniroute.toast.imported": "Imported {{count}} models",
  "provider.omniroute.toast.importedFiltered": "Imported {{count}} models ({{skipped}} skipped)",
  "provider.omniroute.field.combosOnly.label": "Import combos only",
  "provider.omniroute.field.combosOnly.description": "Skip plain provider/model entries and only import combo models",
  "common.confirm": "Confirm",
  "common.clearSearch": "Clear search",
  "dialog.releaseNotes.title": "What's new",
  "browser.panel.toggle": "Browser",
  "browser.panel.back": "Back",
  "browser.panel.forward": "Forward",
  "browser.panel.reload": "Reload",
  "browser.panel.address.placeholder": "Enter a URL",
  "sidebar.batuta": "Batuta",
  "sidebar.tab.code": "Code",
  "sidebar.tab.batuta": "Batuta",
  "sidebar.tab.agentui": "Agents",
  "batuta.title": "What is a Batuta?",
  "batuta.intro": "A batuta is the famous, slender wand a conductor uses to lead an orchestra. Here you can set up an orchestrated activity: pick one model to act as the orchestrator, and other models to act as workers it can delegate tasks to.",
  "batuta.list.title": "Activities",
  "batuta.list.create": "New activity",
  "batuta.list.empty": "No activities yet. Create one to get started.",
  "batuta.list.start": "Start",
  "batuta.model.provider.placeholder": "Provider",
  "batuta.model.model.placeholder": "Model",
  "batuta.form.title.create": "New Batuta activity",
  "batuta.form.title.edit": "Edit Batuta activity",
  "batuta.form.field.name.label": "Name",
  "batuta.form.field.name.placeholder": "e.g. Refactor payments module",
  "batuta.form.field.goal.label": "Goal",
  "batuta.form.field.goal.placeholder": "What should the orchestrator accomplish?",
  "batuta.form.field.orchestrator.label": "Orchestrator model",
  "batuta.form.field.workers.label": "Workers",
  "batuta.form.field.workers.label.placeholder": "Worker label",
  "batuta.form.field.workers.add": "Add worker",
  "batuta.form.field.workers.error.required": "Add at least one worker with a label and a model or command",
  "batuta.form.field.workers.kind.internal": "Internal",
  "batuta.form.field.workers.kind.external": "External CLI",
  "batuta.form.field.workers.command.placeholder": "Command (e.g. claude, codex)",
  "batuta.form.field.workers.command.needsSkill": "Install the batuta-cli skill for this agent in Settings > Agents first",
  "batuta.form.field.workers.args.placeholder": "Arguments (space-separated)",
  "batuta.form.field.worktree.label": "Isolated worker worktrees",
  "batuta.form.field.worktree.description": "Every worker always gets its own git worktree, isolated from your main checkout — the orchestrator reviews and merges each worker's result. This is not configurable.",
  "batuta.form.field.directory.label": "Project",
  "batuta.form.field.directory.description": "The folder this activity's orchestrator and workers run in.",
  "batuta.form.field.directory.error.required": "Choose or add a project folder.",
  "batuta.form.submit.create": "Create",
  "batuta.form.toast.created": "Activity \"{{name}}\" created",
  "batuta.form.toast.updated": "Activity \"{{name}}\" updated",
  "batuta.remove.confirm.title": "Remove activity?",
  "batuta.remove.confirm.description": "\"{{name}}\" will be permanently removed.",
  "batuta.list.viewLive": "View live",
  "batuta.panel.title": "Live activity",
  "batuta.panel.empty": "This activity isn't running. Start it from the activities list to see it live.",
  "batuta.panel.status.idle": "Idle",
  "batuta.panel.status.busy": "Working",
  "batuta.panel.status.retry": "Retrying",
  "batuta.panel.architect.working": "Architect is studying the project and preparing the documents...",
  "batuta.panel.architect.open": "Open architect session",
  "batuta.panel.pipeline.title": "Pipeline",
  "batuta.panel.tab.graph": "Graph",
  "batuta.panel.tab.pipeline": "Pipeline",
  "batuta.panel.tab.kanban": "Kanban",
  "batuta.pipeline.kanban.pending": "Pending",
  "batuta.pipeline.kanban.inProgress": "In progress",
  "batuta.pipeline.kanban.completed": "Completed",
  "batuta.pipeline.kanban.empty": "Nothing here yet.",
  "batuta.pipeline.phase.planning": "Planning",
  "batuta.pipeline.phase.development": "Development",
  "batuta.pipeline.phase.testing": "Testing",
  "batuta.pipeline.phase.quality": "Quality",
  "batuta.pipeline.phase.delivery": "Delivery",
  "batuta.pipeline.definition.missing": "No pipeline flow defined yet — the Architect will define it while studying the project. Issues appear grouped once it does.",
  "batuta.pipeline.editor.open": "Edit flow",
  "batuta.pipeline.editor.title": "Pipeline flow",
  "batuta.pipeline.editor.description": "Shared across every activity in this project (docs/batuta-pipeline.md). Define phases as \"## Phase name\" headings, each followed by a list of skill slugs (e.g. \"- tdd\"). The Orchestrator re-reads this periodically, so edits apply even mid-run.",
  "batuta.pipeline.editor.save": "Save",
  "batuta.pipeline.editor.tab.editor": "Text",
  "batuta.pipeline.editor.tab.chat": "Chat",
  "batuta.pipeline.chat.description": "Chat with a session restricted to only reading/writing docs/batuta-pipeline.md — it won't appear in the sessions list and can't touch anything else.",
  "batuta.pipeline.chat.placeholder": "Describe the change you want to the pipeline flow...",
  "batuta.pipeline.chat.send": "Send",
  "batuta.pipeline.chat.empty": "No messages yet — send one to start adjusting the flow.",
  "batuta.pipeline.chat.starting": "Starting chat...",
  "batuta.pipeline.stage.architecture": "Architecture",
  "batuta.pipeline.stage.architecture.detail": "The Architect studied the project against the activity's goal, wrote/updated the docs (PRD, DER), used /grill-me to clarify ambiguity, and sliced the work into issues.",
  "batuta.pipeline.stage.orchestration": "Orchestration",
  "batuta.pipeline.stage.orchestration.detail": "The Orchestrator received the Architect's handoff (docs + issues) and started dispatching each issue to the right worker or skill.",
  "batuta.panel.detail.open": "Open full session",
  "batuta.panel.detail.empty": "Nothing yet — waiting for this agent to start working.",
  "batuta.panel.ready.title": "Architect finished — review the plan before starting",
  "batuta.panel.ready.dispatch": "Start activity",
  "batuta.form.field.branch.label": "Branch",
  "batuta.form.field.branch.description": "Branch the main checkout will be on when the activity starts. Leave the detected branch as-is, or type a new name to create and switch to it.",
  "batuta.form.field.branch.placeholder": "Select a branch",
  "batuta.form.field.branch.newPlaceholder": "New branch name",
  "batuta.form.field.branch.create": "New branch",
  "settings.footer.credit": "By: Alltomatos",
  "settings.title": "Settings",
  "settings.section.customize": "Customize",
  "settings.general.section.general": "General",
  "settings.general.section.experimental": "Experimental",
    "settings.general.row.startAtLogin.title": "Start on system boot",
  "settings.general.row.startAtLogin.description": "Automatically start OpenCode when your computer starts or logs in",
  "settings.general.row.startHidden.title": "Start in background",
  "settings.general.row.startHidden.description": "Start minimized to the system tray on startup",
  "settings.general.row.closeToTray.title": "Close to system tray",
  "settings.general.row.closeToTray.description": "Keep OpenCode running in the background in the system tray when closing the window",
"settings.general.row.use3dAnimations.title": "Use 3D animations",
  "settings.general.row.use3dAnimations.description": "Render 3D visuals where available (like the Batuta activity scene) instead of the flat 2D fallback",
  "settings.general.row.devTools.title": "Developer tools",
  "settings.general.row.devTools.description": "Open Chromium DevTools (Console, Network) to debug issues, even in production builds.",
  "settings.general.row.devTools.open": "Open DevTools",
  "settings.general.row.debugMode.title": "Debug mode",
  "settings.general.row.debugMode.description": "Shows a DevTools icon in the titlebar, reachable from any screen, and enables the remote debugging (CDP) port even in packaged/production builds. Requires restarting the app.",
  "settings.general.row.debugMode.descriptionOn": "Enabled — restart the app for the remote debugging port to take effect.",
  "settings.general.row.debugMode.restart": "Restart now",
  "settings.general.row.computerUse.title": "Computer use",
  "settings.general.row.computerUse.description": "Lets the agent control this computer directly — mouse, keyboard, and screen — not just the embedded browser. On by default; every action still asks for confirmation first. Requires restarting the app to take effect.",
  "settings.general.row.computerUse.descriptionOn": "Enabled — restart the app for computer use to take effect.",
  "settings.general.row.computerUse.restart": "Restart now",
  "settings.providers.view.list": "List view",
  "settings.providers.view.grid": "Grid view",
  "settings.mcp.add.button": "Add connector",
  "settings.mcp.add.title": "Add MCP connector",
  "settings.mcp.openConfig.button": "Config raw",
  "settings.mcp.add.known.label": "Known connectors",
  "settings.mcp.add.known.oauthBadge": "OAuth",
  "settings.mcp.add.known.oauthHint": "This connector requires OAuth. Fill in the Client ID / Client secret below, or leave them empty to authorize on first connection.",
  "settings.mcp.add.known.localHint": "This connector runs locally. Build it first (npm install and npm run build), then set the command working directory and the MAIL_MCP_ACCOUNTS_PATH environment variable below to your accounts.json file.",
  "settings.mcp.add.field.name.label": "Name",
  "settings.mcp.add.field.name.placeholder": "my-server",
  "settings.mcp.add.field.type.label": "Connection type",
  "settings.mcp.add.type.local": "Local (command)",
  "settings.mcp.add.type.remote": "Remote (URL)",
  "settings.mcp.add.field.command.label": "Command",
  "settings.mcp.add.field.command.placeholder": "npx -y @some/mcp-server",
  "settings.mcp.add.field.url.label": "URL",
  "settings.mcp.add.field.url.placeholder": "https://example.com/mcp",
  "settings.mcp.add.field.cwd.label": "Working directory (optional)",
  "settings.mcp.add.field.cwd.placeholder": "Relative to the workspace",
  "settings.mcp.add.field.env.label": "Environment variable",
  "settings.mcp.add.field.headers.label": "Header",
  "settings.mcp.add.field.timeout.label": "Timeout in ms (optional)",
  "settings.mcp.add.field.timeout.placeholder": "5000",
  "settings.mcp.add.toast.title": "Connector \"{{name}}\" added",
  "settings.mcp.edit.title": "Edit MCP connector",
  "settings.mcp.edit.toast.title": "Connector \"{{name}}\" updated",
  "settings.mcp.remove.confirm.title": "Remove connector",
  "settings.mcp.remove.confirm.description": "Remove \"{{name}}\" from your MCP servers? This deletes it from your config, not just disconnects it.",
  "settings.mcp.remove.button": "Remove",
  "settings.mcp.remove.toast.title": "Connector \"{{name}}\" removed",
  "settings.mcp.auth.connect.button": "Connect",
  "settings.mcp.auth.needsClientRegistration.hint": "This server needs a pre-registered OAuth client. Edit this connector and fill in the OAuth client ID/secret.",
  "settings.mcp.add.field.oauthClientId.label": "OAuth client ID (optional)",
  "settings.mcp.add.field.oauthClientSecret.label": "OAuth client secret (optional)",
  "settings.mcp.catalog.toggle": "Show tools",
  "settings.mcp.catalog.empty": "This server doesn't expose any tools, prompts, or resources.",
  "settings.mcp.catalog.tools": "Tools ({{count}})",
  "settings.mcp.catalog.prompts": "Prompts ({{count}})",
  "settings.mcp.catalog.resources": "Resources ({{count}})",
  "settings.skills.title": "Skill",
  "settings.skills.empty": "No skills found",
  "settings.skills.sources.title": "Sources",
  "settings.skills.sources.claude.title": "See Claude skills",
  "settings.skills.sources.claude.description": "Discover skills from ~/.claude/skills",
  "settings.skills.sources.codex.title": "See Codex skills",
  "settings.skills.sources.codex.description": "Discover skills from ~/.codex/skills",
  "settings.skills.installed.title": "Discovered skills",
  "settings.externalAgents.title": "Agents",
  "settings.externalAgents.refresh": "Refresh",
  "settings.externalAgents.selectAll.title": "Select all detected agents",
  "settings.externalAgents.selectAll.description": "Installs the batuta-cli skill on every detected agent. Turn off to pick agents individually.",
  "settings.externalAgents.status.detected": "Detected on the connected server",
  "settings.externalAgents.status.notDetected": "Not detected — install the CLI and click Refresh",
  "settings.marketplace.title": "Marketplace",
  "settings.marketplace.add.button": "Add",
  "settings.marketplace.skills.add.title": "Add skill source",
  "settings.marketplace.skills.add.description": "Add a URL that serves an opencode-compatible skills manifest.",
  "settings.marketplace.skills.add.placeholder": "https://example.com/.well-known/skills/",
  "settings.marketplace.mcp.add.title": "Add MCP connector",
  "settings.marketplace.suggestions.title": "Suggestions",
  "settings.marketplace.suggestions.use": "Use",
  "settings.marketplace.skills.suggestions.description": "Not verified against opencode's skill manifest format — paste the real catalog URL to confirm before it imports anything.",
  "settings.marketplace.catalogs.title": "Catalogs",
  "settings.marketplace.catalogs.view": "View",
  "common.remove": "Remove",
  "server.remove.title": "Remove server",
  "server.remove.confirm": "Remove server \"{{name}}\"? Projects and sessions on it will no longer show here.",
  "server.remove.button": "Remove server",
  "provider.omniroute.mcp.testing": "Testing MCP connection...",
  "provider.omniroute.mcp.connected": "MCP connected",
  "provider.omniroute.mcp.failed": "Couldn't connect to the MCP server. Go to {{url}} and enable it, then test again.",
  "provider.omniroute.mcp.retry": "Test again",
  "provider.omniroute.mcp.skip": "Skip MCP",
  "provider.omniroute.mcp.autoconfig": "Connecting will automatically configure the Omniroute MCP server for you.", // TODO: translate (auto-filled from en)
  "dialog.server.menu.qr": "Show QR code", // TODO: translate (auto-filled from en)
  "dialog.server.qr.title": "QR code — {{name}}", // TODO: translate (auto-filled from en)
  "dialog.server.qr.description": "Scan this from a paired mobile client to auto-configure this server — the code carries the same credential this app already uses, so treat it like a password.", // TODO: translate (auto-filled from en)
  "dialog.server.qr.copy": "Copy pairing data", // TODO: translate (auto-filled from en)
  "dialog.server.qr.copied": "Pairing data copied", // TODO: translate (auto-filled from en)
  "sshTunnel.server.viewLogs": "View logs / Connect", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.title": "SSH Connection Status", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.connecting": "Connecting to server...", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.step.testSsh": "SSH Authentication", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.step.checkInstall": "Check / Install OpenCode", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.step.startService": "Start Remote Service", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.step.tunnel": "Establish Local Tunnel", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.logs": "Live Logs", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.retry": "Retry Connection", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.close": "Close", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.done": "Connected", // TODO: translate (auto-filled from en)
  "sshTunnel.progress.failed": "Connection Failed", // TODO: translate (auto-filled from en)
  "sshTunnel.add.cert": "SSH certificate", // TODO: translate (auto-filled from en)
  "sshTunnel.add.certDefault": "Default (SSH agent)", // TODO: translate (auto-filled from en)
  "sshTunnel.add.sshPassword": "SSH password", // TODO: translate (auto-filled from en)
  "sshTunnel.add.autoSetup": "Auto-install opencode on the server", // TODO: translate (auto-filled from en)
  "sshTunnel.server.update": "Update OpenCode", // TODO: translate (auto-filled from en)
  "sshTunnel.server.qrCode": "View QR code", // TODO: translate (auto-filled from en)
  "sshTunnel.server.add": "Add SSH tunnel", // TODO: translate (auto-filled from en)
  "sshTunnel.server.label": "SSH", // TODO: translate (auto-filled from en)
  "sshTunnel.server.menu.label": "SSH tunnel", // TODO: translate (auto-filled from en)
  "sshTunnel.server.retryStart": "Retry connect", // TODO: translate (auto-filled from en)
  "sshTunnel.add.sectionSsh": "1. VPS SSH Access", // TODO: translate (auto-filled from en)
  "sshTunnel.add.sectionOpencode": "2. Remote OpenCode Server", // TODO: translate (auto-filled from en)
  "sshTunnel.add.autoSetupHint": "Auto-installs and launches the server process on the VPS if needed", // TODO: translate (auto-filled from en)
  "sshTunnel.add.title": "Add SSH tunnel", // TODO: translate (auto-filled from en)
  "sshTunnel.add.host": "VPS host", // TODO: translate (auto-filled from en)
  "sshTunnel.add.hostPlaceholder": "e.g. 147.93.176.59 or myserver.com", // TODO: translate (auto-filled from en)
  "sshTunnel.add.sshPort": "SSH port", // TODO: translate (auto-filled from en)
  "sshTunnel.add.sshUsername": "SSH username", // TODO: translate (auto-filled from en)
  "sshTunnel.add.key": "SSH key", // TODO: translate (auto-filled from en)
  "sshTunnel.add.keyDefault": "Default (SSH agent)", // TODO: translate (auto-filled from en)
  "sshTunnel.add.label": "Name (optional)", // TODO: translate (auto-filled from en)
  "sshTunnel.add.labelPlaceholder": "e.g. omniroute", // TODO: translate (auto-filled from en)
  "sshTunnel.add.remotePort": "opencode port on the VPS", // TODO: translate (auto-filled from en)
  "sshTunnel.add.button": "Add tunnel", // TODO: translate (auto-filled from en)
  "sshTunnel.add.error.hostRequired": "Enter the VPS host", // TODO: translate (auto-filled from en)
  "tailscale.server.add": "Add Tailscale tunnel", // TODO: translate (auto-filled from en)
  "tailscale.add.title": "Add Tailscale tunnel", // TODO: translate (auto-filled from en)
  "tailscale.add.host": "Tailscale IP or hostname", // TODO: translate (auto-filled from en)
  "tailscale.add.hostPlaceholder": "e.g. 100.86.156.0 or machine.tailnet.ts.net", // TODO: translate (auto-filled from en)
  "tailscale.add.error.notRunning": "Tailscale not detected on this machine. Install and connect Tailscale before adding this server type.", // TODO: translate (auto-filled from en)
  "tailscale.add.error.unreachable": "Couldn't connect to that address. Make sure the VPS is also on your tailnet and opencode is running there.", // TODO: translate (auto-filled from en)
  "home.server.type.http": "http", // TODO: translate (auto-filled from en)
  "home.server.type.https": "https", // TODO: translate (auto-filled from en)
  "home.server.type.local": "local", // TODO: translate (auto-filled from en)
  "home.server.type.wsl": "wsl", // TODO: translate (auto-filled from en)
  "home.server.type.ssh": "ssh", // TODO: translate (auto-filled from en)
  "home.server.type.tailscale": "tailscale", // TODO: translate (auto-filled from en)
  "settings.general.row.bugReports.title": "Automatic bug reports", // TODO: translate (auto-filled from en)
  "settings.general.row.bugReports.description": "Sends crash reports (error message and stack trace only — never your files, conversations, or env vars) to help fix bugs faster. Reports are deduped against existing GitHub issues before a new one is opened. On by default.", // TODO: translate (auto-filled from en)
  "settings.memory.title": "Memory", // TODO: translate (auto-filled from en)
  "project.forgetMemory.title": "Forget this project's memory too?", // TODO: translate (auto-filled from en)
  "project.forgetMemory.description": "This project has recorded memory. Closing it only removes it from the list (you can reopen it later) — forgetting memory is separate and can't be undone.", // TODO: translate (auto-filled from en)
  "project.forgetMemory.keep": "Keep memory", // TODO: translate (auto-filled from en)
  "project.forgetMemory.forget": "Forget memory", // TODO: translate (auto-filled from en)
  "settings.memory.field.enabled.title": "Enable memory", // TODO: translate (auto-filled from en)
  "settings.memory.field.enabled.description": "Lets the agent search and save cross-session notes on its own, per project and globally. Enabled by default.", // TODO: translate (auto-filled from en)
  "settings.memory.field.memoryModel.title": "Memory model", // TODO: translate (auto-filled from en)
  "settings.memory.field.memoryModel.description": "Model used to summarize and answer memory lookups. Leave empty to use the automatic default.", // TODO: translate (auto-filled from en)
  "settings.memory.quickFill.button": "See suggestions", // TODO: translate (auto-filled from en)
  "settings.memory.toast.saved": "Memory settings saved", // TODO: translate (auto-filled from en)
  "settings.memory.recommended.title": "Recommended memory models", // TODO: translate (auto-filled from en)
  "settings.memory.recommended.notConnected": "Connect Omniroute to see recommended models.", // TODO: translate (auto-filled from en)
  "settings.memory.recommended.noneFound": "No recommended models found in this provider's catalog.", // TODO: translate (auto-filled from en)
  "settings.memory.recommended.apply": "Apply", // TODO: translate (auto-filled from en)
  "settings.memory.recommended.tier.ok": "paid, no known limit", // TODO: translate (auto-filled from en)
  "settings.memory.recommended.tier.limited": "free, usage-limited", // TODO: translate (auto-filled from en)
  "settings.integrations.title": "Integrations", // TODO: translate (auto-filled from en)
  "settings.integrations.section.channels": "Channels", // TODO: translate (auto-filled from en)
  "settings.integrations.telegram.title": "Telegram", // TODO: translate (auto-filled from en)
  "settings.integrations.telegram.description": "Connect a Telegram bot to chat with opencode from Telegram. Create a bot with @BotFather, copy the token it gives you, and paste it here.", // TODO: translate (auto-filled from en)
  "settings.integrations.telegram.field.token.placeholder": "Bot token", // TODO: translate (auto-filled from en)
  "settings.integrations.telegram.error.required": "Enter a bot token", // TODO: translate (auto-filled from en)
  "settings.integrations.telegram.toast.connected.title": "Telegram bot connected", // TODO: translate (auto-filled from en)
  "dialog.server.qr.loopbackWarning": "This server only listens on this computer (127.0.0.1) and Tailscale isn't running here, so a phone can't reach it with this code. Start Tailscale on this machine, or pair with a server that has a real network address instead.", // TODO: translate (auto-filled from en)
  "batuta.model.model.filterPlaceholder": "Filter models…", // TODO: translate (auto-filled from en)
  "batuta.model.model.truncated": "Showing the first {{count}} matches — keep typing to narrow it down", // TODO: translate (auto-filled from en)
  "settings.combos.title": "Combos", // TODO: translate (auto-filled from en)
  "settings.combos.add.button": "Add combo", // TODO: translate (auto-filled from en)
  "settings.combos.empty": "No combos yet.", // TODO: translate (auto-filled from en)
  "settings.combos.modelCount": "{{count}} models", // TODO: translate (auto-filled from en)
  "settings.combos.error.incomplete": "Give the combo a name and pick a model for every row.", // TODO: translate (auto-filled from en)
  "settings.combos.toast.saved": "Combo saved", // TODO: translate (auto-filled from en)
  "settings.combos.dialog.addTitle": "Add combo", // TODO: translate (auto-filled from en)
  "settings.combos.dialog.editTitle": "Edit combo", // TODO: translate (auto-filled from en)
  "settings.combos.field.name": "Name", // TODO: translate (auto-filled from en)
  "settings.combos.field.models": "Models", // TODO: translate (auto-filled from en)
  "settings.combos.addModel": "Add model", // TODO: translate (auto-filled from en)
  "settings.combos.field.failover": "Failover", // TODO: translate (auto-filled from en)
  "settings.combos.field.failoverStrategy": "Failover strategy", // TODO: translate (auto-filled from en)
  "settings.combos.failover.priority": "Priority order", // TODO: translate (auto-filled from en)
  "settings.combos.failover.roundRobin": "Round-robin", // TODO: translate (auto-filled from en)
  "settings.combos.field.requestsPerMinute": "Requests / minute (optional)", // TODO: translate (auto-filled from en)
  "settings.combos.field.tokensPerMinute": "Tokens / minute (optional)", // TODO: translate (auto-filled from en)
  "settings.agentui.title": "My Agents", // TODO: translate (auto-filled from en)
  "settings.agentui.add.button": "Create agent", // TODO: translate (auto-filled from en)
  "settings.agentui.empty": "No agents yet.", // TODO: translate (auto-filled from en)
  "settings.agentui.error.incomplete": "Give the agent a name and pick a model.", // TODO: translate (auto-filled from en)
  "settings.agentui.error.telegramNeedsProject": "Bu ajana kendi Telegram botunu vermek için bu sayfayi bagli bir projeden açin.",
  "settings.agentui.error.whatsappIncomplete": "Bu sayfayi bagli bir projeden açin ve seçilen WhatsApp saglayicisi için tüm gerekli alanlari doldurun.",
  "settings.agentui.toast.saved": "Agent saved", // TODO: translate (auto-filled from en)
  "settings.agentui.dialog.addTitle": "Create agent", // TODO: translate (auto-filled from en)
  "settings.agentui.dialog.editTitle": "Edit agent", // TODO: translate (auto-filled from en)
  "settings.agentui.ai.title": "Yapay Zeka ile Olustur",
  "settings.agentui.ai.hint": "Istediginiz ajani kendi sözcüklerinizle tanimlayin — ad, kisilik ve ayarlar incelemeniz için asagida taslak olarak hazirlanacaktir.",
  "settings.agentui.ai.placeholder": "örn. Randevu sorularini yanitlayan samimi bir dis klinigi resepsiyonisti...",
  "settings.agentui.ai.generate": "Olustur",
  "settings.agentui.ai.generating": "Olusturuluyor…",
  "settings.agentui.ai.toast.generated": "Taslak olusturuldu — kaydetmeden önce inceleyin",
  "settings.agentui.tabs.general": "General", // TODO: translate (auto-filled from en)
  "settings.agentui.tabs.channels": "Channels", // TODO: translate (auto-filled from en)
  "settings.agentui.tabs.tools": "Tools", // TODO: translate (auto-filled from en)
  "settings.agentui.tabs.knowledge": "Knowledge", // TODO: translate (auto-filled from en)
  "settings.agentui.field.mcpServers": "MCP servers", // TODO: translate (auto-filled from en)
  "settings.agentui.field.mcpServers.hint": "Let this agent call tools from the MCP servers below, connected to the same project as its channels. Off by default — agents are conversational-only until you turn one on.", // TODO: translate (auto-filled from en)
  "settings.agentui.field.mcpServers.empty": "No MCP servers configured for this project yet. Add one in Settings ? MCP first.", // TODO: translate (auto-filled from en)
  "settings.agentui.field.mcpServers.noDirectory": "Open a project first to see its MCP servers.", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.providerLink": "Open {{provider}} dashboard ?", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.izapiaSessions.fetch": "Fetch sessions", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.izapiaSessions.loading": "Fetching…", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.izapiaSessions.empty": "No sessions found for this API key.", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.izapiaSessions.label": "WhatsApp sessions (select one or more)", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.izapiaGroups.label": "Groups", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.izapiaGroups.hint": "Direct messages are always answered. Check any groups the agent should also answer in — groups left unchecked are ignored.", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.izapiaGroups.fetch": "Fetch groups", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.izapiaGroups.loading": "Fetching…", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.izapiaGroups.empty": "No groups found for the selected sessions.", // TODO: translate (auto-filled from en)
    "settings.agentui.field.whatsapp.tunnel.tailscale.hint": "Simplest option if you already have Tailscale running on this machine and the provider's server: use this machine's Tailscale IP directly, no tunnel process needed.", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.tunnel.tailscale.use": "Use Tailscale IP", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.tunnel.tailscale.detecting": "Detecting…", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.tunnel.tailscale.notFound": "No Tailscale IP found. Is Tailscale installed and running?", // TODO: translate (auto-filled from en)
"settings.agentui.field.whatsapp.tunnel.hint": "This server's URL is local (127.0.0.1/localhost) — the provider can't call it back to deliver messages. Start a public tunnel so it can.", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.tunnel.start": "Start public tunnel", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.tunnel.starting": "Starting…", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.tunnel.active": "Public tunnel active: {{url}} — the webhook URL below now uses it.", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.tunnel.error": "Couldn't start the tunnel. Is cloudflared installed?", // TODO: translate (auto-filled from en)
  "settings.agentui.tabs.audit": "Audit", // TODO: translate (auto-filled from en)
  "settings.agentui.audit.title": "Message log", // TODO: translate (auto-filled from en)
  "settings.agentui.audit.refresh": "Refresh", // TODO: translate (auto-filled from en)
  "settings.agentui.audit.loading": "Loading…", // TODO: translate (auto-filled from en)
  "settings.agentui.audit.needsSave": "Save the agent first to see its message log.", // TODO: translate (auto-filled from en)
  "settings.agentui.audit.empty": "No messages logged yet.", // TODO: translate (auto-filled from en)
  "settings.agentui.audit.blocked": "Blocked", // TODO: translate (auto-filled from en)
  "settings.agentui.audit.incoming": "Received", // TODO: translate (auto-filled from en)
  "settings.agentui.audit.outgoing": "Replied", // TODO: translate (auto-filled from en)
  "settings.agentui.field.name": "Name", // TODO: translate (auto-filled from en)
  "settings.agentui.field.personality": "Personality", // TODO: translate (auto-filled from en)
  "settings.agentui.field.model": "Model", // TODO: translate (auto-filled from en)
  "settings.agentui.field.telegram": "Reply on Telegram", // TODO: translate (auto-filled from en)
  "settings.agentui.field.telegramToken.placeholder": "Bot tokeni (istege bagli — genel botu paylasmak için bos birakin)",
  "settings.agentui.field.telegramToken.hint": "Bu ajana kendine özel bir Telegram botu vermek için @BotFather'dan bir token yapistirin. Bos birakirsaniz, Ayarlar ? Entegrasyonlar bölümündeki paylasilan bot üzerinden, komut önekini kullanarak erisilir.",
  "settings.agentui.field.whatsapp": "WhatsApp'ta yanitla",
  "settings.agentui.field.whatsapp.hint": "Resmi olmayan bir WhatsApp API'si kullanir (waconector üzerinden) — bir saglayici seçin ve baglanti bilgilerini doldurun. Kendi kendine barindirilan saglayicilar, ayri çalisan kendi sunucusuna/konteynerine ihtiyaç duyar.",
  "settings.agentui.field.whatsapp.webhookUrl": "Webhook URL'si — saglayicinin panosuna yapistirin",
  "settings.agentui.field.whatsapp.webhookSecret": "Webhook secret — some providers (e.g. izapia) ask for this separately", // TODO: translate (auto-filled from en)
  "settings.agentui.field.whatsapp.webhookAfterSave": "Saglayici tarafinda yapilandirilacak Webhook URL'si kaydettikten sonra burada görünür.",
  "settings.agentui.field.commandTriggers": "Command triggers (space-separated, e.g. ! #)", // TODO: translate (auto-filled from en)
  "settings.agentui.field.guardrails": "Guardrails", // TODO: translate (auto-filled from en)
  "settings.agentui.field.guardrailsLevel": "Guardrails level", // TODO: translate (auto-filled from en)
  "settings.agentui.guardrails.basic": "Basic", // TODO: translate (auto-filled from en)
  "settings.agentui.guardrails.strict": "Strict", // TODO: translate (auto-filled from en)
  "settings.agentui.field.ragSources": "Knowledge sources", // TODO: translate (auto-filled from en)
  "settings.agentui.rag.label": "Label", // TODO: translate (auto-filled from en)
  "settings.agentui.rag.value": "Text or URL", // TODO: translate (auto-filled from en)
  "settings.agentui.rag.add": "Add source", // TODO: translate (auto-filled from en)
  "settings.agentui.rag.note": "File upload and real retrieval land in a later phase — these are stored as-is for now.", // TODO: translate (auto-filled from en)
  "settings.agentui.field.enabled": "Enabled",
  "settings.agentui.enable": "Enable agent",
  "settings.agentui.disable": "Disable agent",
  "settings.agentui.sandbox.open": "Test",
  "settings.agentui.sandbox.title": "Test {{name}}",
  "settings.agentui.sandbox.empty": "Send a message to try this agent — same personality, model and guardrails it uses for real, in a private test conversation.",
  "settings.agentui.sandbox.placeholder": "Type a message...",
  "settings.agentui.sandbox.send": "Send",
  "settings.agentui.sandbox.reset": "New conversation",
  "settings.agentui.sandbox.noDirectory": "Open a project first to test this agent.",
  "settings.agentui.form.title.create": "New agent",
  "settings.agentui.form.title.edit": "Edit agent",
  "settings.agentui.form.testHint": "Save the agent first to test it.",
  "sidebar.stats": "KPIs & Stats", // TODO: translate (auto-filled from en)
  "command.stats.open": "Open KPIs & Token Analytics", // TODO: translate (auto-filled from en)
  "stats.title": "KPIs & Token Analytics", // TODO: translate (auto-filled from en)
  "stats.description": "Overall summary of token generation, input/output ratio, reasoning tokens, cache efficiency, and costs.", // TODO: translate (auto-filled from en)
  "stats.refresh": "Refresh", // TODO: translate (auto-filled from en)
  "stats.filter.range": "Period", // TODO: translate (auto-filled from en)
  "stats.filter.today": "Today", // TODO: translate (auto-filled from en)
  "stats.filter.7d": "7 Days", // TODO: translate (auto-filled from en)
  "stats.filter.30d": "30 Days", // TODO: translate (auto-filled from en)
  "stats.filter.all": "All Time", // TODO: translate (auto-filled from en)
  "stats.filter.project": "Project", // TODO: translate (auto-filled from en)
  "stats.filter.project.all": "All projects", // TODO: translate (auto-filled from en)
  "stats.kpi.totalTokens": "Total Tokens", // TODO: translate (auto-filled from en)
  "stats.kpi.totalTokens.sub": "Input + Output + Reasoning + Cache", // TODO: translate (auto-filled from en)
  "stats.kpi.outputTokens": "Output Tokens", // TODO: translate (auto-filled from en)
  "stats.kpi.outputTokens.sub": "Generated completion tokens", // TODO: translate (auto-filled from en)
  "stats.kpi.inputTokens": "Input Tokens", // TODO: translate (auto-filled from en)
  "stats.kpi.inputTokens.sub": "Prompt & context tokens", // TODO: translate (auto-filled from en)
  "stats.kpi.reasoningTokens": "Reasoning Tokens", // TODO: translate (auto-filled from en)
  "stats.kpi.reasoningTokens.sub": "Model thinking process", // TODO: translate (auto-filled from en)
  "stats.kpi.cacheTokens": "Cache Read / Write", // TODO: translate (auto-filled from en)
  "stats.kpi.cacheTokens.sub": "Cache hit efficiency", // TODO: translate (auto-filled from en)
  "stats.kpi.totalCost": "Estimated Cost", // TODO: translate (auto-filled from en)
  "stats.kpi.totalCost.sub": "Total API spend", // TODO: translate (auto-filled from en)
  "stats.kpi.totalSessions": "Total Sessions", // TODO: translate (auto-filled from en)
  "stats.kpi.totalSessions.sub": "Sessions in selected range", // TODO: translate (auto-filled from en)
  "stats.kpi.avgTokens": "Avg / Session", // TODO: translate (auto-filled from en)
  "stats.kpi.avgTokens.sub": "Average token consumption", // TODO: translate (auto-filled from en)
  "stats.kpi.tps": "Output Tokens/s (TPS)", // TODO: translate (auto-filled from en)
  "stats.kpi.tps.sub": "Avg speed (over session active time)", // TODO: translate (auto-filled from en)
  "stats.distribution.title": "Token Distribution", // TODO: translate (auto-filled from en)
  "stats.distribution.input": "Input", // TODO: translate (auto-filled from en)
  "stats.distribution.output": "Output", // TODO: translate (auto-filled from en)
  "stats.distribution.reasoning": "Reasoning", // TODO: translate (auto-filled from en)
  "stats.distribution.cache": "Cache Read", // TODO: translate (auto-filled from en)
  "stats.breakdown.models": "Usage by Model", // TODO: translate (auto-filled from en)
  "stats.breakdown.agents": "Usage by Agent", // TODO: translate (auto-filled from en)
  "stats.breakdown.projects": "Usage by Project", // TODO: translate (auto-filled from en)
  "stats.breakdown.col.name": "Name", // TODO: translate (auto-filled from en)
  "stats.breakdown.col.tokens": "Tokens", // TODO: translate (auto-filled from en)
  "stats.breakdown.col.output": "Output", // TODO: translate (auto-filled from en)
  "stats.breakdown.col.reasoning": "Reasoning", // TODO: translate (auto-filled from en)
  "stats.breakdown.col.cost": "Cost", // TODO: translate (auto-filled from en)
  "stats.breakdown.col.sessions": "Sessions", // TODO: translate (auto-filled from en)
  "stats.breakdown.col.share": "Share", // TODO: translate (auto-filled from en)
  "stats.activity.title": "Daily Token Consumption", // TODO: translate (auto-filled from en)
  "stats.sessions.title": "Recent Sessions", // TODO: translate (auto-filled from en)
  "stats.sessions.empty": "No sessions found for this period", // TODO: translate (auto-filled from en)
  "stats.sessions.col.title": "Session", // TODO: translate (auto-filled from en)
  "stats.sessions.col.model": "Model", // TODO: translate (auto-filled from en)
  "stats.sessions.col.tokens": "Tokens", // TODO: translate (auto-filled from en)
  "stats.sessions.col.cost": "Cost", // TODO: translate (auto-filled from en)
  "stats.sessions.col.time": "Date", // TODO: translate (auto-filled from en)
  "stats.sessions.open": "Open", // TODO: translate (auto-filled from en)
  "context.stats.workTime": "Work Time", // TODO: translate (auto-filled from en)
  "stats.kpi.totalDuration": "Total Work Time", // TODO: translate (auto-filled from en)
  "stats.kpi.totalDuration.sub": "Total time agent worked", // TODO: translate (auto-filled from en)
  "stats.kpi.longestDuration": "Longest Request", // TODO: translate (auto-filled from en)
  "stats.kpi.longestDuration.sub": "Max time on a single task", // TODO: translate (auto-filled from en)
  "stats.sessions.col.duration": "Work Time", // TODO: translate (auto-filled from en)
} satisfies Partial<Record<Keys, string>>
