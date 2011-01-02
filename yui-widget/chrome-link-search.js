YUI.add('chrome-link-search', function (Y) {

    var Body = Y.one('body'),
        keyCodeFor = {
            ESC: 27,
            SINGLE_QUOTE: 222,
            G: 71,
        };

    LinkSearch.NAME = 'linkSearch';
    LinkSearch.LABEL_TEMPLATE = '<label for="chrome-link-search-field">{LABEL}</label>';
    LinkSearch.FIELD_TEMPLATE = '<input id="chrome-link-search-field" type="text"></input>';

    function LinkSearch (config) {
        LinkSearch.superclass.constructor.apply(this, arguments);
    }

    LinkSearch.ATTRS = {

        strings: {
            value: {
                label: 'Quick Find (links only):'
            }
        },

        highlightColor: {
            value: '',
        },

        searchMode: {
            value: false,
            broadcast: 1,
        },

        queryString: {
            value: '',
            broadcast: 1,
        },

        // caches matching links (property: link text, value: array of matched links)
        matchCache: {
            value: {},
        },

        matchedLinks: {
            value: [],
            broadcast: 1,
        },

        numMatchedLinks: {
            value: 0,
        },

        // matchedLinks index of the focused link
        focusIndex: {
            value: null,
            broadcast: 1,
        },

        // NodeList snapshot of all links
        allLinks: {
            value: null,
        },
    };


    Y.extend(LinkSearch, Y.Widget, {

        destructor : function() {
            Y.detach('linksearch|*');
        },

        renderUI : function() {

            var contentBox = this.get('contentBox'),
                boundingBox = this.get('boundingBox'),
                labelText = this.getString('label'),
                color = this.get('highlightColor'),
                label = Y.Node.create(Y.substitute(LinkSearch.LABEL_TEMPLATE, { LABEL: labelText })),
                field = Y.Node.create(LinkSearch.FIELD_TEMPLATE),
                css = '.yui3-linksearch { position:fixed; top:0; right:0; }' +
                      '.yui3-linksearch-content { background:#DDD; opacity:0.9; padding:5px 10px; border:1px solid #CCC; border-bottom-left-radius:10px }';
                      '.yui3-linksearch input { margin-left:5px; border-radius:5px; }' +
                      '.yui3-linksearch label { color:#444; font-size:0.9em; }';

            if (color) {
                css += '.yui3-linksearch-match { background:' + color + ' }';
            }
            Y.StyleSheet(css);

            contentBox.appendChild(label);
            contentBox.appendChild(field);

            this.field = field;
        },

        bindUI : function() {
            Body.on('linksearch|keyup', Y.bind(this._triggerSearchMode, this));
            this.field.on('keyup', Y.bind(this._searchModeKeyUpHandler, this));

            this.after('searchModeChange', Y.bind(this._afterSearchModeChange, this));
            this.after('queryStringChange', Y.bind(this._afterQueryStringChange, this));
            this.after('matchedLinksChange', Y.bind(this._afterMatchedLinksChange, this));
            this.after('focusIndexChange', Y.bind(this._afterFocusIndexChange, this));
        },

        syncUI : function() {
            this.set('visible', this.get('searchMode'));
        },

        _triggerSearchMode : function (e) {
            if (e.keyCode === keyCodeFor.SINGLE_QUOTE) {
                this.set('searchMode', true);
                this.field.focus();
            }
        },

        _searchModeKeyUpHandler : function (e) {
            this.set('queryString', this.field.get('value'));
        },

        _searchModeKeyDownHandler : function (e) {
            if (e.keyCode === keyCodeFor.ESC) {
                this.set('searchMode', false);
            }
            else if (e.shiftKey && e.metaKey && e.keyCode === keyCodeFor.G) {
                e.halt();
                this._incrementFocusLinkIndex('decrement');
            }
            else if (e.metaKey && e.keyCode === keyCodeFor.G) {
                e.halt();
                this._incrementFocusLinkIndex();
            }
        },

        _incrementFocusLinkIndex : function (decrement) {
            // don't increment/decrement the focus index unless there are matched links
            if (!this.get('numMatchedLinks')) {
                return;
            }

            var focusIndex = this.get('focusIndex'),
                increment  = !decrement;

            // nothing focused yet
            if (focusIndex === null) {
                this.set('focusIndex', 0);
            }
            // increment wrap around
            else if (increment && focusIndex + 1 >= this.get('numMatchedLinks')) {
                this.set('focusIndex', 0);
            }
            // decrement wrap around
            else if (decrement && focusIndex === 0) {
                this.set('focusIndex', this.get('numMatchedLinks') - 1);
            }
            // increment/decrement
            else {
                this.set('focusIndex', increment ? focusIndex + 1 : focusIndex - 1);
            }
        },

        _getMatchingLinks : function (query) {
            if (query === '') {
                return [];
            }

            var cache = this.get('matchCache');

            if (cache[query]) {
                return cache[query];
            }

            var regex = new RegExp(query, 'i'),
                links = this.get('allLinks'),
                matches = [];

            links.each(function (el) {
                var matchesText  = regex.test(el.get('textContent')),
                    inRenderTree = el.get('offsetParent');

                if (matchesText && inRenderTree) {
                    matches.push(el);
                }
            });

            cache[query] = matches;

            return matches;
        },

        _afterSearchModeChange : function (e) {
            var searchModeIsActive = e.newVal;

            if (searchModeIsActive) {
                this.set('visible', true);
                this.set('allLinks', Y.all('a'));
                this.field.focus();

                Body.on('searchmode|keydown', Y.bind(this._searchModeKeyDownHandler, this));
            }
            else {
                this.set('visible', false);
                this.set('allLinks', null);
                this.field.set('value', '');
                this.set('matchCache', {});
                this.set('matchedLinks', []);

                Y.detach('searchmode|*'); // detach all search mode events
            }
        },

        _afterFocusIndexChange : function (e) {
            var index = e.newVal;

            if (index === null) {
                return;
            }

            this.get('matchedLinks')[index].focus();
        },

        _afterQueryStringChange : function (e) {
            this.set('matchedLinks', this._getMatchingLinks(e.newVal));
        },

        _afterMatchedLinksChange : function (e) {
            this._removeHighlighting(e.prevVal || []);
            this._addHighlighting(e.newVal);

            this.set('numMatchedLinks', e.newVal.length);
            this.set('focusIndex', null);

            this._scrollFirstMatchIntoView();
        },


        _scrollFirstMatchIntoView : function () {
            var matched = this.get('matchedLinks');

            if (matched.length) {
                matched[0].focus();
                this.field.focus();
            }
        },

        _addHighlighting : function (links) {
            this._highlighter(links, true);
        },

        _removeHighlighting : function (links) {
            this._highlighter(links, false);
        },

        _highlighter : function (links, add) {
            if (this.get('highlightColor')) {
                for (var i = 0, len = links.length; i < len; i++) {
                    links[i][add ? 'addClass' : 'removeClass']('yui3-linksearch-match');
                }
            }
        },

    });

    Y.LinkSearch = LinkSearch;

}, '3.2.0', {requires:['widget', 'substitute', 'stylesheet']});


YUI().use('chrome-link-search', function (Y) {
    var linksearch = new Y.LinkSearch({highlightColor: 'yellow'});
    linksearch.render();
});
