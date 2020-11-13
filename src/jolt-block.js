import "./jolt-block.scss";
import getParameterByName from "./helpers/getParameterbyName";
import HttpClient from "./helpers/HttpClient";
import getWordCount from "./helpers/getWordCount";
import getScrollPercent from "./helpers/getScrollPercent";
import create from "./helpers/create";
import offset from "./helpers/offset";
import uniqueSelector from 'css-selector-generator';

(function () {
  let lastHoveredElement = null;
  const isProduction = false;
  const baseUrl = isProduction ? 'https://api.joltblock.com' : 'http://localhost:5000';
  const startTime = +new Date();
  let furthestScroll = 0;
  let hasTrackedEvent = false;

  if (hasTrackedEvent) {
    return;
  }
  const words = getWordCount(document.body);

  if (getParameterByName('jid')) {
    // Load in the script for setup
    // GET blog settings
    // Display builder with options from current blog pre-filled
    createInsertLine();
    document.onmouseover = moveInsertLine;

    window.addEventListener('scroll',function () {
      moveInsertLine(lastHoveredElement);
    });

    window.onresize = function () {
      moveInsertLine(lastHoveredElement);
    }

    function createInsertLine() {
      const line = create('div');
      const plusButton = create('div');
      plusButton.className = 'jb_plus-button';
      plusButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="40.333" height="40.332" viewBox="0 0 40.333 40.332" class="jb_plus-icon">
  <path id="np_plus_178497_000000" d="M59.9,44.8H44.8V59.9a2.53,2.53,0,1,1-5.06,0V44.8H24.632a2.53,2.53,0,1,1,0-5.06H39.738V24.632a2.53,2.53,0,0,1,5.06,0V39.738H59.9a2.47,2.47,0,0,1,2.53,2.53A2.513,2.513,0,0,1,59.9,44.8Z" transform="translate(-22.102 -22.102)" fill="#fff"/>
</svg>
`;
      line.className = 'jb_insert-line';
      line.append(plusButton);
      plusButton.addEventListener('click', e => {
        //TODO: This should show the iframe above or below the plus button!!!
        const elementSelector = uniqueSelector(lastHoveredElement.target);
        console.log('INSERT BLOCK AFTER THIS SELECTOR:', elementSelector);
        // TODO: DEFER THIS UNTIL AFTER ALL SETTINGS HAVE BEEN CHOSEN?
        window.JoltBlock.enableCommentsBlock(elementSelector);
      });

      document.body.append(line);
    }

    function moveInsertLine(e) {
      if (e === null) {
        return;
      }

      const elementOffset = offset(e.target);
      // CHECK IF WE SHOULD BE MOVING IT TO THE RIGHT SPOT
      if (e.target.className && typeof e.target.className === 'string' && e.target.className.indexOf('jb_') >= 0) return;

      if ((e.target.tagName !== 'DIV' && e.target.tagName !== 'SECTION') || offset.width <= 90 || offset.height < 1) {
        if (e.target.parentNode) {
          moveInsertLine({target: e.target.parentNode});
        }
        return;
      }

      var insertLine = document.querySelector('.jb_insert-line');
      insertLine.style.top = `${elementOffset.top + elementOffset.height - 1}px`;
      insertLine.style.left = `${elementOffset.left}px`;
      insertLine.style.width = `${elementOffset.width}px`;
      e.target.style.paddingBottom = e.target.style.paddingBottom + 20;
      lastHoveredElement = e;
    }
  }

  const urlFragmentAfterSlash = window.location.href.split('?')[0].split('/')[3];
  const isArticleOverride = document.querySelector('[property="og:type"]') && document.querySelector('[property="og:type"]').content === 'article';

  if ((
    urlFragmentAfterSlash.length <= 1 ||
    urlFragmentAfterSlash === 'preview' ||
    urlFragmentAfterSlash === 'tag' ||
    urlFragmentAfterSlash === 'author' ||
    urlFragmentAfterSlash === 'tags' ||
    urlFragmentAfterSlash === 'categories' ||
    urlFragmentAfterSlash === 'authors'
  ) && !isArticleOverride) {
    return;
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

          window.JoltBlock.setUpBlocks();
        }
      });
    }

    trackEvent(data) {
      hasTrackedEvent = true;
      const url = `${baseUrl}/analytics/track?blog=${data.blog}&article=${data.article}&type=${data.type}&scroll=${data.scrolled}&timeOnPage=${data.timeOnPage}`;
      client.get(url);
    }

    setUpBlocks() {
      // ===== ADD BLOCKS ===== //

      // 1 - COMMENTS
      this.addCommentBlock();
    }

    addCommentBlock() {
      if (this.settings && this.settings.hasOwnProperty('commentsEnabled') && this.settings.commentsEnabled) {
        const elementBefore = document.querySelector(this.settings.commentsElement);
        if (elementBefore.length < 1) {
          return;
        }

        const iframe = create('iframe');
        iframe.src = `https://app.joltblock.com/blocks/comments/${this.articleId}`;

        const container = create('div');
        container.className = 'jb_block-container jb_block-comments';
        container.append(iframe);
        elementBefore.parentNode.insertBefore(container, elementBefore.nextSibling);
      }
    }

    enableCommentsBlock(selector) {
      const requestUrl = `${baseUrl}/settings`;
      console.log('ENABLING:', selector);
      client.put(requestUrl, {commentsEnabled: true, commentsElement: selector, id: this.blogId}, response => {
        //TODO: Make this more secure. Check the jid and 401 if not matching.
        console.log('ENABLING RESPONSE:', response);
      });
    }
  }

  window.onscroll = () => {
    const currentScroll = document.documentElement.scrollTop + document.body.scrollTop;
    if (currentScroll > furthestScroll) {
      furthestScroll = currentScroll;
    }
    const [type] = getEventType();
    if (type === 'read' && !hasTrackedEvent) {
      track();
    }
  }

  window.JoltBlock = new JoltBlock();
  window.JoltBlock.getBlogSettings();

  function track() {
    if (hasTrackedEvent) {
      return;
    }
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
    const likelyPercentageRead = minutesOnPage < requiredMinutesToRead ? minutesOnPage / requiredMinutesToRead * 100 : 100;
    const percentScrolled = getScrollPercent(furthestScroll);
    const isRead = likelyPercentageRead >= 50 && percentScrolled >= 75;
    const isSkim = likelyPercentageRead >= 25 && percentScrolled >= 50;
    return [isRead ? 'read' : isSkim ? 'skim' : 'bounce', timeOnPage, percentScrolled];
  }
})();
