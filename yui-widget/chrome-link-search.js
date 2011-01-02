YUI.add('chrome-link-search', function (Y) {

    /* Any frequently used shortcuts, strings and constants */
    var Body = Y.one('body'),
        keyCodeFor = {
            ESC: 27,
            SINGLE_QUOTE: 222,
            G: 71,
        };

    LinkSearch.NAME = 'linkSearch';
    LinkSearch.LABEL_TEMPLATE = '<label for="link-search">{LABEL}</label>';
    LinkSearch.FIELD_TEMPLATE = '<input id="link-search" name="link-search" type="text"></input>';

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

        // matchedLinks index of the focused link
        matchedLinksFocusIndex: {
            value: null,
            broadcast: 1,
            setter: '_setMatchedLinksFocusIndex',
        },

        // NodeList snapshot of all links
        allLinks: {
            value: null,
            /*
            , valueFn: "_defAttrAVal"      // Can be used as a substitute for "value", when you need access to "this" to set the default value.
            , setter: "_setAttrA"          // Used to normalize attrA's value while during set. Refers to a prototype method, to make customization easier
            , getter: "_getAttrA"          // Used to normalize attrA's value while during get. Refers to a prototype method, to make customization easier
            , validator: "_validateAttrA"  // Used to validate attrA's value before updating it. Refers to a prototype method, to make customization easier
            , broadcast: 1                 // Whether the attribute change event should be broadcast or not.
            */
        },
    };


    Y.extend(LinkSearch, Y.Widget, {

        initializer: function() {
        },

        destructor : function() {
        },

        renderUI : function() {

            var contentBox = this.get('contentBox'),
                boundingBox = this.get('boundingBox'),
                labelText = this.getString('label'),
                label = Y.Node.create(Y.substitute(LinkSearch.LABEL_TEMPLATE, { LABEL: labelText })),
                field = Y.Node.create(LinkSearch.FIELD_TEMPLATE);

            // TODO: move all these styles into a stylesheet
            field.setStyles({
                marginLeft: '3px',
                borderRadius: '5px',
            });
            label.setStyles({
                color: '#444',
            });
            boundingBox.setStyles({
                position: 'fixed',
                top: '0',
                right: '0',
            });
            contentBox.setStyles({
                background: '#DDD',
                opacity: '0.9',
                padding: '5px 10px',
                border: '1px solid #ccc',
                borderBottomLeftRadius: '10px',
            });

            if (this.get('highlightColor')) {
                Y.one('head').append(
                    Y.Node.create('<style>.link-search-match{background:' + this.get('highlightColor') + '}</style>')
                );
            }

            contentBox.appendChild(label);
            contentBox.appendChild(field);

            this.field = field;
        },

        bindUI : function() {
            Body.on('keyup', Y.bind(this._triggerSearchMode, this));
            this.field.on('keyup', Y.bind(this._searchModeKeyUpHandler, this));

            this.after('searchModeChange', Y.bind(this._afterSearchModeChange, this));
            this.after('queryStringChange', Y.bind(this._afterQueryStringChange, this));
            this.after('matchedLinksChange', Y.bind(this._afterMatchedLinksChange, this));
            this.after('matchedLinksFocusIndexChange', Y.bind(this._afterMatchedLinksFocusIndexChange, this));
        },

        syncUI : function() {
            this.set('visible', this.get('searchMode'));
        },

        _triggerSearchMode : function (e) {
            if (e.keyCode === keyCodeFor.SINGLE_QUOTE) {
                this.set('searchMode', true);
                this._focusSearchField();
            }
        },

        _searchModeKeyUpHandler : function (e) {
            this.set('queryString', this.field.get('value'));
        },

        _searchModeKeyDownHandler : function (e) {
            if (e.keyCode === keyCodeFor.ESC) {
                this.set('searchMode', false);
            }
            else if (e.metaKey && e.keyCode === keyCodeFor.G) {
                e.halt();
                this._incrementFocusedLinkIndex();
                Y.log('focusing through matched links');
            }
        },

        _incrementFocusedLinkIndex : function () {
            var index = this.get('matchedLinksFocusIndex');
            this.set('matchedLinksFocusIndex', index === null ? 0 : index + 1);
        },

        _setMatchedLinksFocusIndex : function (index) {
            var numMatchedLinks = this.get('matchedLinks').length;

            if (!numMatchedLinks) {
                return;
            }

            return index >= numMatchedLinks ? 0 : index; // wrap
        },

        _afterMatchedLinksFocusIndexChange : function (e) {
            var index = e.newVal;

            if (index === null) {
                return;
            }

            var link = this.get('matchedLinks')[index];

            if (this._isInRenderTree(link)) {
                link.focus();
            }
            else {
                this._incrementFocusedLinkIndex();
            }
        },

        // Made an assumption that any element in the render tree should have an offset parent.
        _isInRenderTree : function (link) {
            return link.get('offsetParent');
        },

        _afterQueryStringChange : function (e) {
            this.set('matchedLinks', this._getMatchingLinks(e.newVal));
        },

        _afterMatchedLinksChange : function (e) {
            this._removeHighlighting(e.prevVal || []);
            this._addHighlighting(e.newVal);

            this.set('matchedLinksFocusIndex', null);
            this._scrollToFirstMatch();
        },

        _scrollToFirstMatch : function () {
            this._incrementFocusIndex();
            this._focusSearchField();
        },

        // Null out the focus index whenever we focus on the search field.
        _focusSearchField : function () {
            this.set('matchedLinksFocusIndex', null);
            this.field.focus();
        },

        _incrementFocusIndex : function () {
            var index = this.get('matchedLinksFocusIndex');
            this.set('matchedLinksFocusIndex', index === null ? 0 : index + 1);
        },

        _getMatchingLinks : function (query) {
            if (query === '') {
                return [];
            }

            var cache = this.get('matchCache');

            if (cache[query]) {
                Y.log('CACHE HIT');
                return cache[query];
            }

            var regex = new RegExp(query, 'i'),
                links = this.get('allLinks'),
                matches = [];

            links.each(function (el) {
                if (regex.test(el.get('textContent'))) {
                    matches.push(el);
                }
            });

            cache[query] = matches;

            Y.log('CACHE MISS');
            return matches;
        },

        _afterSearchModeChange : function (e) {
            var searchModeIsActive = e.newVal;

            if (searchModeIsActive) {
                this.set('visible', true);
                this.set('allLinks', Y.all('a'));
                this._focusSearchField();

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


        /*** UTILS ***/

        _addHighlighting : function (links) {
            this._highlighter(links, true);
        },

        _removeHighlighting : function (links) {
            this._highlighter(links, false);
        },

        _highlighter : function (links, add) {
            if (this.get('highlightColor')) {
                for (var i = 0, len = links.length; i < len; i++) {
                    links[i][add ? 'addClass' : 'removeClass']('link-search-match');
                }
            }
        },

    });

    Y.LinkSearch = LinkSearch;

}, '3.2.0', {requires:['widget', 'substitute']});


YUI().use('chrome-link-search', function (Y) {
    var linksearch = new Y.LinkSearch({highlightColor: 'yellow'});
    linksearch.render();
    Y.log('READY');
});
