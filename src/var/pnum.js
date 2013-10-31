define([
	"./rnum"
], function( rnum ) {
	return rnum.source.replace( /\(/g, "(?:" );
});
