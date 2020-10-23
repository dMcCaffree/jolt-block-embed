import "./jolt-block.scss";
import create from "./helpers/create";
import buildAudioInner from "./components/AudioInner";
import buildTextInner from "./components/TextInner";
import createEventListeners from "./helpers/createEventListeners";
import getUrlParameter from "./helpers/getUrlParameter";
import addStyleTag from "./helpers/addStyleTag";

(function () {
  initSpotlight();

  var spotlight;
  var spotlightSettings;

  function initSpotlight() {
    spotlightSettings = window.spotlightSettings;
    getSpotlightData();

    var client = new HttpClient();
    var baseUrl = "https://spotlight-api.herokuapp.com/v1";

    function Spotlight() {
      this.setWorkspaceId = this._setWorkspaceId;
      this.getSpotlight = this._getSpotlight;
      this.track = this._track;
    }

    Spotlight.prototype._setWorkspaceId = function (workspaceId) {
      this.workspaceId = workspaceId;
    };

    Spotlight.prototype._getSpotlight = function () {
      var that = this;
      var querySpotlightId =
        getUrlParameter("spotlight") ||
        sessionStorage.getItem("targetedSpotlight");

      if (querySpotlightId) {
        sessionStorage.setItem("targetedSpotlight", querySpotlightId);
      }

      var targetedSpotlight =
        querySpotlightId || spotlightSettings.spotlightId || null;
      var url = baseUrl + "/spotlights/widget?workspaceId=" + this.workspaceId;

      if (targetedSpotlight) {
        url += "&spotlightId=" + targetedSpotlight;
      } else {
        url += "&path=" + encodeURI(window.location.pathname);

        var utm_source = getParameterByName('utm_source');
        var utm_medium = getParameterByName('utm_medium');
        var utm_content = getParameterByName('utm_content');
        var utm_term = getParameterByName('utm_term');
        var utm_campaign = getParameterByName('utm_campaign');

        url += "&utm_source=" + utm_source;
        url += "&utm_medium=" + utm_medium;
        url += "&utm_content=" + utm_content;
        url += "&utm_term=" + utm_term;
        url += "&utm_campaign=" + utm_campaign;
      }

      client.get(url, function (response) {
        response = JSON.parse(response);

        that.type = response.type;
        that.headline = response.headline;
        that.fileUrl = response.fileUrl;
        that.primaryColor = response.primaryColor;
        that.secondaryColor = response.secondaryColor;
        that.ctaText = response.ctaText;
        that.ctaUrl = response.ctaUrl;
        that.spotlightId = response.spotlightId;
        that.openNewTab = response.openNewTab;
      });
    };

    Spotlight.prototype._track = function (eventType) {
      var url =
        baseUrl +
        "/analytics/spotlights/" +
        this.spotlightId +
        "/" +
        eventType +
        "?workspace=" +
        this.workspaceId +
        "&url=" +
        encodeURI(window.location.href);

      client.get(url);
    };

    window.Spotlight = new Spotlight();

    function HttpClient() {
      this.get = function (url, callback) {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
          if (request.readyState === 4 && request.status === 200 && callback)
            callback(request.responseText);
        };

        request.open("GET", url, true);
        request.send(null);
      };
    }
  }

  /* THE REST IS FUNCTION DECLARATIONS */
  function getSpotlightData() {
    if (typeof window.Spotlight === "object") {
      spotlight = window.Spotlight;
      spotlight.setWorkspaceId(spotlightSettings.workspaceId);
      spotlight.getSpotlight();

      buildWidget();
    } else {
      setTimeout(getSpotlightData, 100);
    }
  }

  function buildWidget() {
    var widgetContainerExists =
      document.getElementsByClassName("spotlt_container").length > 0;

    if (!widgetContainerExists) {
      var innerContainer;
      var container = create("div");
      container.classList = "spotlt_container";
      var cushion = create("div");

      var allElements = document.body.getElementsByTagName("*");

      for (var i = 0; i < allElements.length; i++) {
        var currentElement = allElements[i];
        var computedStyle = window.getComputedStyle(currentElement);
        if (
          (computedStyle.position === "fixed" ||
            computedStyle.position === "sticky") &&
          computedStyle.top === "0px" &&
          (computedStyle.left === "0px" || computedStyle.left === "auto") &&
          (computedStyle.right === "0px" || computedStyle.right === "auto") &&
          currentElement.offsetHeight > 20 &&
          computedStyle.opacity === "1"
        ) {
          currentElement.style.top = "60px";
          container.style.position = "fixed";
          container.style.top = "0";
          cushion.classList = "spotlt_cushion";
        }
      }

      var siteWrapper = document.getElementById("siteWrapper");
      if (siteWrapper) {
        siteWrapper.style.position = "relative";
      }

      document.body.insertBefore(cushion, document.body.children[0]);

      document.body.insertBefore(container, document.body.children[0]);
    }

    if (spotlight.headline) {
      addStyleTag(spotlight);
      spotlight.track("visit");

      if (spotlight.type === "audio") {
        // innerContainer = buildAudioInner(spotlight);
        innerContainer = buildAudioInner(spotlight);
      } else if (spotlight.type === "text") {
        innerContainer = buildTextInner(spotlight);
      } else {
        console.log(
          "This spotlight type is not yet supported:",
          spotlight.type
        );
      }

      document
        .getElementsByClassName("spotlt_container")[0]
        .appendChild(innerContainer);

      createEventListeners();
    } else {
      setTimeout(buildWidget, 100);
    }
  }
})();

function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  var finalParam = decodeURIComponent(results[2].replace(/\+/g, ' '));
  if (finalParam) {
    return finalParam;
  } else {
    return "";
  }
}
