YUI().use('node', 'selector-css3', 'event', function (Y) {

var HIGHLIGHT_COLOR = 'yellow';

var keyCodeFor = {
    ESC: 27,
    SINGLE_QUOTE: 222,
    G: 71
};


var searchField = (function () {

    var field = Y.Node.create('<input id="link-search" type="text"></input>'),
        inDoc = false;

    field.setStyles({
        position: 'fixed',
        top: '0',
        right: '0',
        minWidth: '10px',
    });

    function append () {
        if (!inDoc) {
            inDoc = true;
            Y.one('body').append(field);
            linkMatcher.init();
        }
        field.focus();
    }

    function remove () {
        if (inDoc) {
            inDoc = false;
            field.remove();
            field.set('value', '');
        }
    }

    function getValue () {
        return field.get('value');
    }

    function isInDoc () {
        return inDoc;
    }

    return {
        isInDoc:  isInDoc,
        field:    field,
        getValue: getValue,
        remove:   remove,
        append:   append
    };

})();


var linkMatcher = (function () {

    var allLinks     = null,         // all links in doc
        currentIndex = resetIndex(), // index of currently selected link
        lastMatch    = [],           // previously matching set of links
        matchCache   = {};           // cache for matching sets

    if (HIGHLIGHT_COLOR) {
        Y.one('head').append(
            Y.Node.create('<style>.link-search-match{background:' + HIGHLIGHT_COLOR + '}</style>')
        );
    }

    function init () {
        allLinks     = Y.all('a');
        matchCache   = {};
    }

    function match (text) {
        var matched = getMatchingLinks(text);

        // highlighting logic
        removeHighlighting(lastMatch);
        addHighlighting(matched);

        lastMatch = matched;
        resetIndex();
        showFirstMatch();
    }

    function resetIndex () {
        currentIndex = -1;
    }

    function showFirstMatch () {
        focusMatch(0); // use focus to scroll window
        searchField.isInDoc() && searchField.field.focus(); // return focus to search field
    }

    function focusMatch (index) {
        lastMatch.length && lastMatch[index].focus();
    }

    function focusNext () {
        if (lastMatch.length) {
            if (currentIndex < 0 || currentIndex + 1 >= lastMatch.length) { // initialize or wrap
                currentIndex = 0;
            }
            else {
                currentIndex += 1;
            }

            focusMatch(currentIndex);
        }
    }

    function getMatchingLinks (text) {
        if (text === '') {
            return [];
        }

        var cacheHit;
        if (cacheHit = matchCache[text]) {
            return cacheHit;
        }

        var regex = new RegExp(text, 'i'),
            matches = [];

        allLinks.each(function (el) {
            if (regex.test(el.get('textContent'))) {
                matches.push(el);
            }
        });

        matchCache[text] = matches;

        return matches;
    }

    function addHighlighting (links) {
        highlighter(links, true);
    }

    function removeHighlighting (links) {
        highlighter(links, false);
    }

    function highlighter (links, add) {
        if (HIGHLIGHT_COLOR && lastMatch instanceof Array) {
            for (var i = 0, len = links.length; i < len; i++) {
                links[i][add ? 'addClass' : 'removeClass']('link-search-match');
            }
        }
    }

    return {
        init:  init,
        match: match,
        focusNext: focusNext
    };



})();



var body = Y.one('body');

body.on('keydown', function (e) {
    if (!searchField.isInDoc()) {
        return;
    }

    if (e.keyCode === keyCodeFor.ESC) {
        searchField.remove();
        linkMatcher.match('');
    }
    else if (e.metaKey && e.keyCode === keyCodeFor.G) {
        e.halt();
        linkMatcher.focusNext();
    }
});

body.on('keyup', function (e) {
    if (e.keyCode === keyCodeFor.SINGLE_QUOTE) {
        searchField.append();
    }
});

searchField.field.on('keyup', function (e) {
    linkMatcher.match(searchField.getValue());
});



});
