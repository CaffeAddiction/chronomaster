/**
 * ChronoMaster Rewarded Ads
 * Only opt-in rewarded ads: the player always chooses to watch, and always sees the reward first.
 *
 * Android (Capacitor + @capacitor-community/admob): real AdMob rewarded ads with UMP consent.
 * Browser / dev: a clearly-labelled test overlay so every placement can be tried without a device.
 */
const AD_CONFIG = {
  // Google's public TEST rewarded unit. Replace with your own unit id before release.
  rewardedId: 'ca-app-pub-3940256099942544/5224354917',
  testing: true,
  childDirected: false,
  // Per-placement daily caps keep ads a bonus, never a grind
  dailyCaps: { revive: 6, double: 8, booster: 8, undo: 5, gift: 6, daily: 1, vitrin: 4 },
  dailyTotal: 30
};

class AdService {
  constructor(store) {
    this.store = store;
    this.native = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) || null;
    this.loaded = !this.native; // the web mock is always "loaded"
    this.busy = false;
    this.init();
  }

  async init() {
    if (!this.native) return;
    try {
      await this.native.initialize({
        initializeForTesting: AD_CONFIG.testing,
        tagForChildDirectedTreatment: AD_CONFIG.childDirected
      });
      // UMP consent form (EEA/UK/Swiss users); safe no-op elsewhere
      const info = await this.native.requestConsentInfo();
      if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') {
        await this.native.showConsentForm();
      }
    } catch (e) {
      console.warn('[ads] init failed', e);
    }
    this.preload();
  }

  async preload() {
    if (!this.native) return;
    try {
      await this.native.prepareRewardVideoAd({ adId: AD_CONFIG.rewardedId, isTesting: AD_CONFIG.testing });
      this.loaded = true;
    } catch (e) {
      this.loaded = false;
      setTimeout(() => this.preload(), 30000);
    }
  }

  get counts() {
    const ads = this.store.data.ads;
    const today = SaveStore.today();
    if (ads.day !== today) {
      ads.day = today;
      ads.counts = {};
    }
    return ads.counts;
  }

  remaining(placement) {
    const c = this.counts;
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    const cap = AD_CONFIG.dailyCaps[placement] || 5;
    return Math.max(0, Math.min(cap - (c[placement] || 0), AD_CONFIG.dailyTotal - total));
  }

  isAvailable(placement) {
    return !this.busy && this.loaded && this.remaining(placement) > 0;
  }

  /** Resolves true only if the player watched to the end. */
  async showRewarded(placement) {
    if (this.busy) return false;
    if (this.remaining(placement) <= 0) {
      window.fx && window.fx.toast('Bugünlük bu ödülün sınırına ulaştın. Yarın tekrar gel!');
      return false;
    }
    if (!this.loaded) {
      window.fx && window.fx.toast('Reklam henüz hazır değil, birazdan tekrar dene.');
      this.preload();
      return false;
    }
    this.busy = true;
    window.soundEngine && window.soundEngine.duck(true);
    let rewarded = false;
    try {
      rewarded = this.native ? await this.showNative() : await this.showMock();
    } finally {
      this.busy = false;
      window.soundEngine && window.soundEngine.duck(false);
    }
    if (rewarded) {
      this.counts[placement] = (this.counts[placement] || 0) + 1;
      this.store.save();
    }
    return rewarded;
  }

  showNative() {
    const ad = this.native;
    return new Promise(resolve => {
      let rewarded = false;
      const handles = [];
      const done = () => {
        handles.forEach(h => Promise.resolve(h).then(x => x && x.remove && x.remove()));
        this.loaded = false;
        this.preload();
        resolve(rewarded);
      };
      handles.push(ad.addListener('onRewardedVideoAdReward', () => { rewarded = true; }));
      handles.push(ad.addListener('onRewardedVideoAdDismissed', done));
      handles.push(ad.addListener('onRewardedVideoAdFailedToShow', done));
      ad.showRewardVideoAd().then(item => { if (item) rewarded = true; }).catch(done);
    });
  }

  /** Browser stand-in: 3 s countdown, closing early forfeits the reward. */
  showMock() {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'mock-ad';
      el.innerHTML = `
        <div class="mock-ad-card">
          <div class="mock-ad-tag">TEST REKLAMI</div>
          <div class="mock-ad-art">📺</div>
          <p>Android sürümünde burada gerçek bir ödüllü reklam oynar.</p>
          <div class="mock-ad-bar"><div class="mock-ad-fill"></div></div>
          <button class="btn-primary mock-ad-claim" disabled>3</button>
          <button class="mock-ad-close" aria-label="Kapat">&times;</button>
        </div>`;
      document.getElementById('game-container').appendChild(el);
      const claim = el.querySelector('.mock-ad-claim');
      const fill = el.querySelector('.mock-ad-fill');
      let left = 3;
      requestAnimationFrame(() => { fill.style.width = '100%'; });
      const timer = setInterval(() => {
        left--;
        if (left > 0) {
          claim.textContent = String(left);
        } else {
          clearInterval(timer);
          claim.disabled = false;
          claim.textContent = 'ÖDÜLÜ AL ✓';
        }
      }, 1000);
      const finish = ok => {
        clearInterval(timer);
        el.remove();
        resolve(ok);
      };
      claim.addEventListener('click', () => finish(true));
      el.querySelector('.mock-ad-close').addEventListener('click', () => finish(false));
    });
  }

  async showPrivacyOptions() {
    if (this.native && this.native.showPrivacyOptionsForm) {
      try { await this.native.showPrivacyOptionsForm(); return true; } catch (e) { return false; }
    }
    return false;
  }
}

window.AdService = AdService;
window.AD_CONFIG = AD_CONFIG;
