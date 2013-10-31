define(function() {

function toDecimal( num, sign, whole, point, fraction, e, exponent ) {
	return !e ?
		num :
		exponent > 0 ?
			sign + whole + fraction + Array( exponent - (point && fraction.length) + 1 ).join( 0 ) :
			sign + "." + Array( -exponent ).join( 0 ) + whole + fraction;
}

return toDecimal;

});
