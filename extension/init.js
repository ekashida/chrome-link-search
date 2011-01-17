YUI().use('*', function (Y) {

    var linksearch = new Y.LinkSearch({
        strings: {
            label: 'Link Search:'
        },
        matchColor: 'yellow'
    });

    linksearch.render();

});
