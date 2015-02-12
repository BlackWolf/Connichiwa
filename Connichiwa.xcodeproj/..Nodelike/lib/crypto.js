var CryptoJS = require('crypto-js');

function Hash(algorithm, isHmac, secret) {
	if (secret == undefined) secret = "";
	if (isHmac == undefined) isHmac = false;

	algorithm = algorithm.toLowerCase();

	this.crypto = undefined;

	if (isHmac) {
		var cryptoAlgorithm;
		switch (algorithm) {
			case 'md5': cryptoAlgorithm = CryptoJS.algo.MD5; break;
			case 'sha1': cryptoAlgorithm = CryptoJS.algo.SHA1; break;
			case 'sha256': cryptoAlgorithm = CryptoJS.algo.SHA256; break;
			case 'sha512': cryptoAlgorithm = CryptoJS.algo.SHA512; break;
		}

		this.crypto = CryptoJS.algo.HMAC.create(cryptoAlgorithm, secret);
	} else {
		switch (algorithm) {
			case 'md5': this.crypto = CryptoJS.algo.MD5.create(); break;
			case 'sha1': this.crypto = CryptoJS.algo.SHA1.create(); break;
			case 'sha256': this.crypto = CryptoJS.algo.SHA256.create(); break;
			case 'sha512': this.crypto = CryptoJS.algo.SHA512.create(); break;
		}
	}
}

Hash.prototype.update = function(data) {
	this.crypto.update(data);
	return this;
};

Hash.prototype.digest = function(encoding) {
	if (encoding == undefined) return this.crypto.finalize();

	encoding = encoding.toLowerCase();

	var cryptoEncoding;
	switch (encoding) {
		case 'base64': cryptoEncoding = CryptoJS.enc.Base64; break;
		case 'utf8': cryptoEncoding = CryptoJS.enc.Utf8; break;
		case 'hex': cryptoEncoding = CryptoJS.enc.Hex; break;
	}

	return this.crypto.finalize().toString(cryptoEncoding);
};

exports.createHash = function(algorithm) {
	return new Hash(algorithm, false);
};

exports.createHmac = function(algorithm, secret) {
	return new Hash(algorithm, true, secret);
};
