import "./jolt-block.scss";
import getParameterByName from "./helpers/getParameterbyName";
import HttpClient from "./helpers/HttpClient";
import getScrollPercent from "./helpers/getScrollPercent";
import create from "./helpers/create";
import offset from "./helpers/offset";
import uniqueSelector from 'css-selector-generator';
import io from './lib/socket.io';

(function () {
  let lastURL = window.location.href.split('#')[0];
  // TODO: Move these to different helper?
  history.pushState = ( f => function pushState(){
    const ret = f.apply(this, arguments);
    window.dispatchEvent(new Event('pushstate'));
    window.dispatchEvent(new Event('locationchange'));
    return ret;
  })(history.pushState);

  history.replaceState = ( f => function replaceState(){
    const ret = f.apply(this, arguments);
    window.dispatchEvent(new Event('replacestate'));
    window.dispatchEvent(new Event('locationchange'));
    return ret;
  })(history.replaceState);

  window.addEventListener('popstate',()=>{
    window.dispatchEvent(new Event('locationchange'))
  });

  window.addEventListener('locationchange', function(){
    if (window.location.href.split('#')[0] !== lastURL) {
      runJoltBlock();
    }
  });

  let lastHoveredElement = null;
  const isProduction = true;
  const baseUrl = isProduction ? 'https://api.joltblock.com' : 'http://localhost:5000';
  const wsUrl = isProduction ? 'https://api.plaudy.com' : 'http://localhost:5001';
  const iframeBaseUrl = isProduction ? 'https://app.joltblock.com' : 'http://localhost:3000';
  const socket = io(wsUrl);
  const startTime = +new Date();
  let furthestScroll = 0;
  let hasTrackedEvent = false;
  let tooltipIsOpen = false;
  let retryAttempt = 0;

  if (hasTrackedEvent) {
    return;
  }

  runJoltBlock();

  function runJoltBlock() {
    //TODO: MAKE THIS MORE ACCURATE SOMEHOW
    if (getParameterByName('jid')) {
      createInsertLine();
      createTooltipIframe();
      createEditModeBanner();
      addDisableButtons();
      document.onmouseover = moveInsertLine;

      window.addEventListener('scroll', function () {
        moveInsertLine(lastHoveredElement, true);
        moveTooltip();
      });

      window.onresize = function () {
        moveInsertLine(lastHoveredElement, true);
        moveTooltip();
      }

      document.addEventListener('click', e => {
        if (e.target.className && typeof e.target.className.indexOf === 'function' && e.target.className.indexOf('jb_') < 0) {
          window.JoltBlock.closeTooltip();
        }
      });

      function addDisableButtons() {
        const disableOverlay = create('div');
        disableOverlay.className = 'jb_disable-overlay';
        disableOverlay.innerHTML = `REMOVE BLOCK 💣`;

        const commentsBlock = document.querySelector('.jb_block-comments');

        if (!commentsBlock) {
          setTimeout(addDisableButtons, 500);
          return;
        }

        commentsBlock.append(disableOverlay);
        commentsBlock.classList.add('customize-mode');

        disableOverlay.addEventListener('click', () => {
          window.JoltBlock.disableCommentsBlock();
        });
      }

      function createEditModeBanner() {
        const container = create('a');
        container.className = 'jb_banner jb_edit-banner';
        container.href = `${iframeBaseUrl}`;

        const content = create('div');
        content.className = 'jb_banner-content';

        const text = create('p');
        text.className = 'jb_banner-text';
        text.innerText = `← ${'\u00A0'} Back to Jolt Block ⚡️`;

        content.append(text);
        container.append(content);
        document.body.append(container);
      }

      function createTooltipIframe() {
        const container = create('div');
        container.className = 'jb_tooltip-container';
        const iframe = create('iframe');
        iframe.src = `${iframeBaseUrl}/blocks/tooltips/add`;

        container.append(iframe);

        document.body.append(container);
      }

      function createInsertLine() {
        const line = create('div');
        const plusButton = create('div');
        plusButton.className = 'jb_plus-button';
        plusButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="40.333" height="40.332" viewBox="0 0 40.333 40.332" class="jb_plus-icon">
            <path id="np_plus_178497_000000" d="M59.9,44.8H44.8V59.9a2.53,2.53,0,1,1-5.06,0V44.8H24.632a2.53,2.53,0,1,1,0-5.06H39.738V24.632a2.53,2.53,0,0,1,5.06,0V39.738H59.9a2.47,2.47,0,0,1,2.53,2.53A2.513,2.513,0,0,1,59.9,44.8Z" transform="translate(-22.102 -22.102)" fill="#fff"/>
        </svg>
      `;

        line.className = 'jb_insert-line';
        line.append(plusButton);
        plusButton.addEventListener('click', e => {
          //TODO: This should show the iframe above or below the plus button!!!
          const elementOffset = offset(e.target);
          window.JoltBlock.openTooltip();
          const tooltipContainer = document.querySelector('.jb_tooltip-container');
          tooltipContainer.style.top = `${elementOffset.top - tooltipContainer.getBoundingClientRect().height + 15}px`;
          tooltipContainer.style.left = `${elementOffset.left + elementOffset.width / 2}px`;
        });

        document.body.append(line);
      }

      function moveInsertLine(e, isScroll) {
        if (tooltipIsOpen && !isScroll) {
          return;
        }

        if (tooltipIsOpen) {
          var line = document.querySelector('.jb_insert-line');
          const elementOffset = offset(e.target);
          line.style.top = `${elementOffset.top + elementOffset.height - 1}px`;
          line.style.left = `${elementOffset.left}px`;
          line.style.width = `${elementOffset.width}px`;
          return;
        }

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
        lastHoveredElement = e;
      }

      function moveTooltip() {
        if (tooltipIsOpen) {
          const button = document.querySelector('.jb_plus-icon');
          const elementOffset = offset(button);
          const tooltipContainer = document.querySelector('.jb_tooltip-container');
          tooltipContainer.style.top = `${elementOffset.top - tooltipContainer.getBoundingClientRect().height + 15}px`;
          tooltipContainer.style.left = `${elementOffset.left + elementOffset.width / 2}px`;
        }
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
        this.pendingId = '';
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
        const requestUrl = `${baseUrl}/articles?url=${encodedUrl}&title=${title}&blog=${this.blogId}`;

        client.get(requestUrl, response => {
          response = JSON.parse(response);
          if (typeof response === 'object' && response.hasOwnProperty('id')) {
            this.articleId = response.id;
            // window.addEventListener('beforeunload', track);

            client.post(`${wsUrl}/v1/events/pending`, {
              objectId: response.id,
              workspace: '5f9c471b4fd85316d520147a',
              trackedUser: this.blogId,
            }, id => {
              console.log('PENDING ID:', id);
              window.JoltBlock.pendingId = id;
              watchAnalytics();
            });

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

      addCommentBlock(selector) {
        if (window.JoltBlock.settings && window.JoltBlock.settings.hasOwnProperty('commentsEnabled') && window.JoltBlock.settings.commentsEnabled) {
          const elementBefore = selector ? document.querySelector(selector) : document.querySelector(window.JoltBlock.settings.commentsElement);
          if ((elementBefore && elementBefore.length < 1) || !elementBefore) {
            retryAttempt++;
            setTimeout(this.addCommentBlock, 500);
            return;
          }

          const existingCommentsBlock = document.querySelector('.jb_block-comments');

          if (existingCommentsBlock) {
            existingCommentsBlock.remove();
          }

          const container = create('div');
          container.className = 'jb_block-container jb_block-comments';

          const iframe = create('iframe');
          iframe.className = 'jb_block-iframe jb_block-comments-iframe';
          iframe.src = `${iframeBaseUrl}/blocks/comments/${this.articleId}`;

          container.append(iframe);
          elementBefore.parentNode.insertBefore(container, elementBefore.nextSibling);

          if (typeof addDisableButtons === 'function') {
            addDisableButtons();
          }
        } else {
          retryAttempt++;
          setTimeout(this.addCommentBlock, 500);
        }
      }

      enableCommentsBlock(selector) {
        const requestUrl = `${baseUrl}/settings`;
        client.put(requestUrl, {commentsEnabled: true, commentsElement: selector, id: this.blogId}, response => {
          //TODO: Make this more secure. Check the jid and 401 if not matching.
          this.addCommentBlock(selector);
          window.JoltBlock.closeTooltip();
        });
      }

      disableCommentsBlock() {
        const requestUrl = `${baseUrl}/settings`;
        client.put(requestUrl, {commentsEnabled: false, commentsElement: '', id: this.blogId}, response => {
          //TODO: Make this more secure. Check the jid and 401 if not matching.
          const existingCommentsBlock = document.querySelector('.jb_block-comments');
          if (existingCommentsBlock) {
            existingCommentsBlock.remove();
          }
          window.JoltBlock.closeTooltip();

          const tooltipIframee = document.querySelector('.jb_tooltip-container iframe');

          if (tooltipIframee) {
            tooltipIframee.contentWindow.postMessage('disable comments', '*');
          }
        });
      }

      openTooltip() {
        const tooltipContainer = document.querySelector('.jb_tooltip-container');
        tooltipContainer.classList.add('show');
        tooltipIsOpen = true;
      }

      closeTooltip() {
        const tooltipContainer = document.querySelector('.jb_tooltip-container');
        tooltipContainer.classList.remove('show');
        tooltipIsOpen = false;
      }
    }

    // window.onscroll = () => {
    //   const currentScroll = document.documentElement.scrollTop + document.body.scrollTop;
    //   if (currentScroll > furthestScroll) {
    //     furthestScroll = currentScroll;
    //   }
    //   const [type] = getEventType();
    //   if (type === 'read' && !hasTrackedEvent) {
    //     track();
    //   }
    // }

    // Listener for window.parent.postMessage() from React web app's iframe
    window.addEventListener('message', event => {
      if (event.origin !== iframeBaseUrl) {
        return;
      }

      if (event.data === 'enable comments') {
        const elementSelector = uniqueSelector(lastHoveredElement.target);
        window.JoltBlock.enableCommentsBlock(elementSelector);
      }

      if (event.data === 'disable comments') {
        window.JoltBlock.disableCommentsBlock();
      }

      if (event.data === 'close') {
        window.JoltBlock.closeTooltip();
      }
    });

    // Init window.JoltBlock and kick things off
    window.JoltBlock = new JoltBlock();
    window.JoltBlock.getBlogSettings();
  }

  function watchAnalytics() {
    if (window.JoltBlock.pendingId) {
      socket.emit('pageview', window.JoltBlock.pendingId);
    }
  }

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
    const requiredMinutesToRead = 1 // 225 is average-ish wpm reading
    const minutesOnPage = timeOnPage / 60000;
    const likelyPercentageRead = minutesOnPage < requiredMinutesToRead ? minutesOnPage / requiredMinutesToRead * 100 : 100;
    const percentScrolled = getScrollPercent(furthestScroll);
    const isRead = likelyPercentageRead >= 50 && percentScrolled >= 75;
    const isSkim = likelyPercentageRead >= 25 && percentScrolled >= 50;
    return [isRead ? 'read' : isSkim ? 'skim' : 'bounce', timeOnPage, percentScrolled];
  }
})();
