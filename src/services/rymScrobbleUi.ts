import rymUi from "./rymUi";

export default class rymScrobbleUi {
  private enabled = false;
  private _rymUi: rymUi;

  private marqueeId = "rymscrobblemarquee";
  private progBarId = "progbar";
  private scrobbleNowId = "scrobblenow";
  private scrobbleThenId = "scrobblethen";
  private testId = "scrobbletest";
  private checkboxClass = "rymscrobblechk";
  private selectAllOrNoneId = "allornone";
  private authButtonId = "rymscrobbleauth";
  private authStatusId = "rymscrobbleauthstatus";
  private disconnectId = "rymscrobbledisconnect";
  private apiSetupContainerId = "rymscrobbleapisetup";
  private apiKeyInputId = "rymscrobbleapikey";
  private apiSecretInputId = "rymscrobbleapisecret";
  private saveApiCredsId = "rymscrobblesaveapicreds";
  private authContainerId = "rymscrobbleauthcontainer";
  private changeApiKeyId = "rymscrobblechangeapikey";

  constructor(rymUi: rymUi) {
    this._rymUi = rymUi;
    if ((this._rymUi.trackListDiv?.children.length ?? 0) === 0) {
      console.log("RYMscrobble: No track list found.");
    } else {
      this.enabled = true;
      this.createCheckboxes();
      this.createControls();
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  createCheckboxes(): void {
    const checkboxTemplate = `<input type="checkbox" class="${this.checkboxClass}" checked="checked">`;
    for (const tracklistLine of this._rymUi.tracklistLines) {
      if (this._rymUi.hasTrackNumber(tracklistLine)) {
        const thisCheckboxElement = document.createElement("span");
        thisCheckboxElement.style.float = "left";
        thisCheckboxElement.innerHTML = checkboxTemplate;
        tracklistLine.prepend(thisCheckboxElement);
      }
    }
  }

  createControls(): void {
    const eleButtonDiv = document.createElement("div");
    eleButtonDiv.className = "rymscrobble-controls";
    eleButtonDiv.innerHTML = `
<table style="border: 0;" cellpadding="0" cellspacing="2px">
  <tr>
    <td style="width: 112px;">
      <input type="checkbox" name="${this.selectAllOrNoneId}" id="${this.selectAllOrNoneId}" style="vertical-align: middle;" checked="checked">&nbsp;
      <label for="${this.selectAllOrNoneId}" style="font-size: 60%;">select&nbsp;all/none</label>
      <br/>
      <table border="2" cellpadding="0" cellspacing="0">
        <tr>
          <td style="height: 50px; width: 103px; background: url(https://cdn.last.fm/flatness/logo_black.3.png) no-repeat; color: #fff;">
            <div class="marquee" style="position: relative; top: 17px; overflow: hidden; white-space: nowrap;">
              <span style="font-size: 80%; width: 88px; display: inline-block; animation: marquee 5s linear infinite;" id="${this.marqueeId}">&nbsp;</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #003;">
            <div style="position: relative; background-color: #f00; width: 0; max-height: 5px; left: 0; top: 0;" id="${this.progBarId}">&nbsp;</div>
          </td>
        </tr>
      </table>
    </td>
    <td>
        <div id="${this.apiSetupContainerId}" style="display: none; font-size: 85%; text-align: left; max-width: 260px; margin-left: auto;">
          Paste a Last.fm <a href="https://www.last.fm/api/account/create" target="_blank" rel="noopener noreferrer">API key</a> to enable scrobbling (free, one-time setup):<br/>
          API key: <input type="text" size="20" id="${this.apiKeyInputId}" /><br/>
          Shared secret: <input type="text" size="20" id="${this.apiSecretInputId}" /><br/>
          <input type="button" id="${this.saveApiCredsId}" value="Save API key" />
        </div>
        <div id="${this.authContainerId}">
          <span id="${this.authStatusId}" style="font-size: 85%;"></span>
          <a href="#" id="${this.changeApiKeyId}" style="font-size: 75%; display: none;">(change API key)</a><br />
          <input type="button" id="${this.authButtonId}" value="Connect to Last.fm" />
          <input type="button" id="${this.disconnectId}" value="Disconnect" style="display: none;" /><br />
          <input type="button" id="${this.scrobbleNowId}" value="Scrobble in real-time" disabled />
          <input type="button" id="${this.scrobbleThenId}" value="Scrobble a previous play" disabled />
          <input type="button" id="${this.testId}" value="Test tracklist parsing" style="display: none;" />
        </div>
      </td>
    </tr>
  </table>`;
    eleButtonDiv.style.textAlign = "right";

    this._rymUi.trackListDiv?.after(eleButtonDiv);
    this.allOrNoneCheckbox.addEventListener("click", () => this.allOrNoneClick(), true);

    const marqueeStyle = document.createElement("style");
    document.head.appendChild(marqueeStyle);
    marqueeStyle.textContent = `
      @keyframes marquee {
        0% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
      }

      .rymscrobble-controls input[type="button"],
      .rymscrobble-controls input[type="text"] {
        margin: 3px 4px;
      }`;
  }

  hookUpScrobbleNow(startScrobble: () => void): void {
    this.scrobbleNowButton.addEventListener("click", startScrobble, true);
  }

  hookUpScrobbleThen(startBatchScrobble: () => void): void {
    this.scrobbleThenButton.addEventListener("click", startBatchScrobble, true);
  }

  hookUpScrobbleTest(callback: () => void): void {
    this.scrobbleTestButton.addEventListener("click", callback, true);
  }

  hookUpAuthButton(callback: () => void): void {
    this.authButton.addEventListener("click", callback, true);
  }

  hookUpDisconnectButton(callback: () => void): void {
    this.disconnectButton.addEventListener("click", callback, true);
  }

  hookUpSaveApiCredentials(callback: (apiKey: string, apiSecret: string) => void): void {
    this.saveApiCredsButton.addEventListener("click", () => {
      callback(this.apiKeyInput.value.trim(), this.apiSecretInput.value.trim());
    }, true);
  }

  hookUpChangeApiKey(callback: () => void): void {
    this.changeApiKeyLink.addEventListener("click", event => {
      event.preventDefault();
      callback();
    }, true);
  }

  setMarquee(value: string): void {
    this.marquee.innerHTML = value;
  }

  setProgressBar(percentage: number): void {
    if (percentage >= 0 && percentage <= 100) {
      this.progressBar.style.width = `${percentage}%`;
    }
  }

  allOrNoneClick(): void {
    window.setTimeout(() => this.allOrNoneAction(), 10);
  }

  allOrNoneAction(): void {
    for (const checkbox of this.checkboxes) {
      checkbox.checked = this.allOrNoneCheckbox.checked;
    }
  }

  elementsOnAndOff(state: boolean): void {
    const controls: (HTMLInputElement | HTMLButtonElement)[] = [
      this.scrobbleNowButton,
      this.scrobbleThenButton
    ];

    for (const control of controls) {
      control.toggleAttribute("disabled", !state);
    }

    for (const checkbox of this.checkboxes) {
      checkbox.toggleAttribute("disabled", !state);
    }
  }

  elementsOff(): void {
    this.elementsOnAndOff(false);
  }

  elementsOn(): void {
    this.elementsOnAndOff(true);
  }

  showApiKeySetup(currentApiKey: string, currentApiSecret: string): void {
    this.apiKeyInput.value = currentApiKey;
    this.apiSecretInput.value = currentApiSecret;
    this.apiSetupContainer.style.display = "";
    this.authContainer.style.display = "none";
    this.elementsOnAndOff(false);
  }

  showDisconnected(): void {
    this.apiSetupContainer.style.display = "none";
    this.authContainer.style.display = "";
    this.changeApiKeyLink.style.display = "";
    this.authStatus.textContent = "Not connected to Last.fm";
    this.authButton.value = "Connect to Last.fm";
    this.authButton.style.display = "";
    this.authButton.toggleAttribute("disabled", false);
    this.disconnectButton.style.display = "none";
    this.elementsOnAndOff(false);
  }

  showAwaitingApproval(): void {
    this.authStatus.textContent = "Approve access on the last.fm tab that just opened, then click below.";
    this.authButton.value = "I've approved it, finish connecting";
    this.authButton.style.display = "";
    this.authButton.toggleAttribute("disabled", false);
    this.disconnectButton.style.display = "none";
  }

  showConnecting(): void {
    this.authButton.toggleAttribute("disabled", true);
  }

  showConnected(username: string): void {
    this.apiSetupContainer.style.display = "none";
    this.authContainer.style.display = "";
    this.changeApiKeyLink.style.display = "";
    this.authStatus.innerHTML = `Connected to Last.fm as <b>${username}</b>`;
    this.authButton.style.display = "none";
    this.disconnectButton.style.display = "";
    this.elementsOnAndOff(true);
  }

  //#region Element getters
  private get allOrNoneCheckbox(): HTMLInputElement {
    return document.getElementById(this.selectAllOrNoneId) as HTMLInputElement;
  }

  private get scrobbleNowButton(): HTMLButtonElement {
    return document.getElementById(this.scrobbleNowId) as HTMLButtonElement;
  }

  private get scrobbleThenButton(): HTMLButtonElement {
    return document.getElementById(this.scrobbleThenId) as HTMLButtonElement;
  }

  private get scrobbleTestButton(): HTMLButtonElement {
    return document.getElementById(this.testId) as HTMLButtonElement;
  }

  private get marquee(): HTMLDivElement {
    return document.getElementById(this.marqueeId) as HTMLDivElement;
  }

  private get progressBar(): HTMLDivElement {
    return document.getElementById(this.progBarId) as HTMLDivElement;
  }

  private get authButton(): HTMLInputElement {
    return document.getElementById(this.authButtonId) as HTMLInputElement;
  }

  private get disconnectButton(): HTMLInputElement {
    return document.getElementById(this.disconnectId) as HTMLInputElement;
  }

  private get authStatus(): HTMLSpanElement {
    return document.getElementById(this.authStatusId) as HTMLSpanElement;
  }

  private get apiSetupContainer(): HTMLDivElement {
    return document.getElementById(this.apiSetupContainerId) as HTMLDivElement;
  }

  private get authContainer(): HTMLDivElement {
    return document.getElementById(this.authContainerId) as HTMLDivElement;
  }

  private get apiKeyInput(): HTMLInputElement {
    return document.getElementById(this.apiKeyInputId) as HTMLInputElement;
  }

  private get apiSecretInput(): HTMLInputElement {
    return document.getElementById(this.apiSecretInputId) as HTMLInputElement;
  }

  private get saveApiCredsButton(): HTMLInputElement {
    return document.getElementById(this.saveApiCredsId) as HTMLInputElement;
  }

  private get changeApiKeyLink(): HTMLAnchorElement {
    return document.getElementById(this.changeApiKeyId) as HTMLAnchorElement;
  }

  get checkboxes(): HTMLCollectionOf<HTMLInputElement> {
    return document.getElementsByClassName(this.checkboxClass) as HTMLCollectionOf<HTMLInputElement>;
  }
  //#endregion
}
