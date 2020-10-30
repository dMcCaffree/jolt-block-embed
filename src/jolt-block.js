import "./jolt-block.scss";
import getParameterByName from "./helpers/getParameterbyName";
import HttpClient from "./helpers/HttpClient";
import getWordCount from "./helpers/getWordCount";
import getScrollPercent from "./helpers/getScrollPercent";

(function () {
  const isProduction = true;
  const baseUrl = isProduction ? 'https://api.joltblock.com' : 'http://localhost:5000';
  const startTime = +new Date();
  let furthestScroll = 0;
  let hasTrackedEvent = false;

  window.onload = () => {
    if (hasTrackedEvent) {
      return;
    }
    const words = getWordCount(document.body);

    if (getParameterByName('jid')) {
      // Load in the script for setup
      // GET blog settings
      // Display builder with options from current blog pre-filled
    }

    // MVP 0.1
    const client = new HttpClient();

    class JoltBlock {
      constructor() {
        this.blogId = window.joltBlockId;
        this.articleId = '';
        this.settings = null;
      }

      getBlogSettings() {
        const url = `${baseUrl}/settings/${this.blogId}`;

        client.get(url, response => {
          response = JSON.parse(response);
          if (typeof response === 'object' && response.hasOwnProperty('analyticsEnabled')) {
            this.settings = response;

            window.JoltBlock.getArticleId();
          }
        });
      }

      getArticleId() {
        const urlWithoutParams = window.location.href.split('?')[0];
        const encodedUrl = encodeURI(urlWithoutParams);
        const title = document.title;
        const requestUrl = `${baseUrl}/articles?url=${encodedUrl}&title=${title}&blog=${this.blogId}&words=${words}`;

        client.get(requestUrl, response => {
          response = JSON.parse(response);
          if (typeof response === 'object' && response.hasOwnProperty('id')) {
            this.articleId = response.id;
            window.addEventListener('beforeunload', track);
          }
        });
      }

      trackEvent(data) {
        hasTrackedEvent = true;
        const url = `${baseUrl}/analytics/track?blog=${data.blog}&article=${data.article}&type=${data.type}&scroll=${data.scrolled}&timeOnPage=${data.timeOnPage}`;
        client.get(url);
      }
    }

    window.onscroll = () => {
      const currentScroll = document.documentElement.scrollTop + document.body.scrollTop;
      if (currentScroll > furthestScroll) {
        furthestScroll = currentScroll;
      }
      const [type] = getEventType();
      if (type === 'read' && !hasTrackedEvent) {
        console.log('TRACKING:', type);
        track();
      }
    }

    window.JoltBlock = new JoltBlock();
    window.JoltBlock.getBlogSettings();

    function track() {
      const [type, timeOnPage, percentScrolled] = getEventType();
      const data = {
        type,
        blog: window.JoltBlock.blogId,
        article: window.JoltBlock.articleId,
        timeOnPage,
        scrolled: percentScrolled,
        //  TODO: Add anonymous user to this
      };

      window.JoltBlock.trackEvent(data);
    }

    function getEventType() {
      const endTime = +new Date();
      const timeOnPage = endTime - startTime;
      const requiredMinutesToRead = words / 225 // 225 is average-ish wpm reading
      const minutesOnPage = timeOnPage / 60000;
      const likelyPercentageRead = minutesOnPage < requiredMinutesToRead ? minutesOnPage / requiredMinutesToRead : 100;
      const percentScrolled = getScrollPercent(furthestScroll);
      const isRead = likelyPercentageRead >= 50 && percentScrolled >= 75;
      const isSkim = likelyPercentageRead >= 25 && percentScrolled >= 50;
      return [isRead ? 'read' : isSkim ? 'skim' : 'bounce', timeOnPage, percentScrolled];
    }

    // 2. Check if article exists / create a new one if not
    // 3. Set tracking visit type conditions:
    //      - Words on page, time on page, scroll amount = read vs skim vs bounce
    //      - Should be set so it will always track *SOMETHING*, bounce worst case maybe on page leave
    // 4. Make a call to Plaudy with whichever tracking event needs to be tracked.

    // MVP 0.2
    // 1. Load all other widgets into the page where they go (take time to make sure this happens async and always after main content loads)
    //      - This should be done in order of visibility, with comments probably always being last
    // 2.
  }
})();
