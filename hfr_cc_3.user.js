// ==UserScript==
// @author        BZHDeveloper, roger21
// @name          [HFR] Copié/Collé v3
// @version       1.6.1
// @namespace     forum.hardware.fr
// @description   Colle les données du presse-papiers et les traite si elles sont reconnues.
// @icon          https://github.com/BZHDeveloper1986/hfr-copie-colle/blob/main/hfr-logo.png?raw=true
// @downloadURL   https://github.com/BZHDeveloper1986/hfr-copie-colle/raw/refs/heads/main/hfr_cc_3.user.js
// @updateURL     https://github.com/BZHDeveloper1986/hfr-copie-colle/raw/refs/heads/main/hfr_cc_3.user.js
// @require       https://unpkg.com/video.js/dist/video.min.js
// @include       https://forum.hardware.fr/*
// @noframes
// @grant         GM.info
// @grant         GM.xmlHttpRequest
// @grant         GM.registerMenuCommand
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_registerMenuCommand
// @grant         GM_xmlhttpRequest
// ==/UserScript==

// Historique
// 1.6.1          ajout des sondages si disponible.

console.log ("Merci pour tout Marc 🕊️");

class Headers {
	#obj;

	constructor() {
		this.#obj = {};
	}

	setHeader (name, value) {
		if (!(name in this.#obj))
			this.#obj[name] = [];
		this.#obj[name].push (value);
	}

	getHeader (name) {
		if (name in this.#obj)
			return this.#obj[name];
		return [];
	}

	get contentType() {
		var a = this.getHeader ("content-type");
		if (a.length == 0)
			return "application/octet-stream";
		return a[0];
	}

	static parse (str) {
		var headers = new Headers();
		var p = str.split ("\n");
		p.forEach (line => {
			var l = line;
			var k = l.substring (0, l.indexOf (":")).trim().toLowerCase();
			l.substring (l.indexOf (":") + 1).split (";").forEach (v => {
				headers.setHeader (k, v.trim());
			});
		});
		return headers;
	}
}

let Hfr = {
	Response : class {
		#rep;
		#hdr;
		#data;

		constructor (r) {
			this.#rep = r;
			this.#hdr = Headers.parse (r.responseHeaders);
			this.#data = r.response.slice (0, r.response.size, this.#hdr.contentType);
		}

		get headers() {
			return this.#hdr;
		}

		blob() {
			return Promise.resolve (this.#data);
		}

		text() {
			return this.#data.text();
		}

		json() {
			return new Promise ((resolve, reject) => {
				this.text().then (txt => {
					try {
						var obj = JSON.parse (txt);
						resolve (obj);
					}
					catch {
						reject (txt);
					}
				}).catch (reject);
			});
		}
	},
	fetch : function (url) {
		return new Promise ((resolve, reject) => {
			Utils.request({
				method : "GET",
				url : url,
				onabort : function() { reject (url); },
				onerror : function() { reject (url); },
				ontimeout : function() { reject (url); },
				headers : { "Cookie" : "" },
				anonymous : true,
				responseType : "blob",
				onload : function (response) {
					resolve (new Hfr.Response (response));
				}
			});
		});
	},
	Image : class {
		#uri;
		#w;
		#h;
		#filled;
		#src;

		constructor (u) {
			this.#uri = u;
		}

		get height() { return this.#h; }

		get width() { return this.#w; }

		get thumbHeight() {
			return 200;
		}

		get thumbWidth() {
			return Math.floor (this.width * 200 / this.height);
		}

		get url() { return this.#uri; }
		set url (u) { this.#uri = u; }

		toString() {
			return `[url=${this.url}][img=${this.thumbWidth},${this.thumbHeight}]${this.#src}[/img][/url]`;
		}

		build() {
			return new Promise ((resolve, reject) => {
				if (this.#filled == true)
					return Promise.resolve (this.toString());
				Hfr.fetch (this.url).then (rep => rep.blob()).then (file => {
					UploadService.getDefault().uploadAsync (file).then (o => {
						console.log (o);
						this.#h = o.height;
						this.#w = o.width;
						this.#src = o.url;
						this.#filled = true;
						resolve (this.toString());
					}).catch (reject);
				}).catch (reject);
			});
		}

		static load (url) {
			
		}
 	}
};

class Video {
	#pst;
	#uri;
	#ctn;
	#gif;

	get poster() { return this.#pst; }
	set poster (p) { this.#pst = p; }

	get url() { return this.#uri; }
	set url (u) { this.#uri = u; }

	get contentType() { return this.#ctn; }
	set contentType (c) { this.#ctn = c; }

	get isGif() { return this.#gif; }
	set isGif (g) { this.#gif = g; }

	toString() {
		var u = new URL (this.url);
		if (this.isGif)
			u.searchParams.append ("gif", "true");
		u.searchParams.append ("hfr-cc-mime-type", this.#ctn);
		return `[url=${u}][img]${this.poster}[/img][/url]\n`;
	}

	build() {
		return Promise.resolve (this.toString());
	}
}

Element.prototype.createPlayer = function (is_gif) {
	var video = document.createElement ("video");
	if (is_gif) {
		video.setAttribute ("loop", "");
		video.setAttribute ("oncanplaythrough", "this.muted=true; this.play()");
	}
	else
		video.setAttribute ("controls", "");
	video.setAttribute ("height", "400");
	video.setAttribute ("class", "video-js");
	this.parentNode.replaceChild (video, this);
	video.player = videojs (video);
	return video;
};

class Embed {
	#data;

	constructor (data) {
		this.#data = data;
	}

	get embedData() {
		return this.#data;
	}

	toString() {
		var builder = new Builder();
		var detail = Utils.getValue ("hfr-copie-colle-detail", "non");
		if (this.#data.description && detail == "oui")
			builder.append (`[url=${this.#data.uri}]${this.#data.site}[/url]\n`);
		builder.append (`[url=${this.#data.uri}][b]${this.#data.title}[/b][/url]\n`);
		if (this.#data.image)
			builder.append (`[url=${this.#data.uri}][img=${this.#data.image.thumb_width},${this.#data.image.thumb_height}]${this.#data.image.source}[/img][/url]\n`);
		var detail = Utils.getValue ("hfr-copie-colle-detail", "non");
		if (this.#data.description && detail == "oui")
			builder.append (`${this.#data.description}`);
		return builder.toString();
	}

	build() {
		return Promise.resolve (this.toString());
	}

	static load (link) {
		return new Promise ((resolve, reject) => {
			(async () => {
				Hfr.fetch ("https://bzhdev18.alwaysdata.net/social/?embed=true&url=" + encodeURIComponent (link))
				.then (rep => rep.json()).then (data => {
					if (data.error)
						reject (link);
					else
						resolve (new Embed (data));
				}).catch (e => {
					console.log (e);
					reject (link);
				});
			})();
		});
	}
}

class Social {
	static objectToString (obj) {
		var builder = new Builder();
		if (obj.quote)
			builder.append (`${Social.objectToString (obj.quote)}\n`);
		builder.append (`[quote][b][url=${obj.link}]${obj.icon} ${obj.user} ${obj.info}[/url][/b]\n\n`);
		builder.append (`${obj.text}\n`);
		obj.videos.forEach (v => {
			var u = new URL (v.source);
			if (v.hasOwnProperty ("info"))
				for (const [key,value] of Object.entries (v["info"]))
					u.searchParams.append (key, value);
			if (v.isGif)
				u.searchParams.append ("gif", "true");
			u.searchParams.append ("hfr-cc-mime-type", v.content_type);
			builder.append (`[url=${u}][img]${v.poster}[/img][/url]`);
		});
		obj.images.forEach (i => {
			builder.append (`[url=${i.source}][img=${i.thumb_width},${i.thumb_height}]${i.source}[/img][/url]`);
		});
		if (obj.embed) {
			builder.append (`[quote]`);
			builder.append (`[url=${obj.embed.uri}][b]${obj.embed.title}[/b][/url]\n`);
			builder.append (`[url=${obj.embed.uri}][img=${obj.embed.image.thumb_width},${obj.embed.image.thumb_height}]${obj.embed.image.source}[/img][/url]`);
			builder.append (`[/quote]`);
		}
		if (obj.poll) {
			for (const [k,v] of Object.entries (obj.poll.options)) {
				var pct = (100 * v / obj.poll.votes).toFixed (2);
				builder.append (`[*] ${k} (${pct} %)\n`);
			}
		}
		builder.append ("[/quote]\n");
		return builder.toString();
	}

	static getFirstVideo (url) {
		return new Promise ((resolve, reject) => {
			Hfr.fetch ("https://bzhdev18.alwaysdata.net/social/?url=" + encodeURIComponent (url)).then (rep => rep.json()).then (data => {
				if (data.error)
					reject (url);
				else if (data.videos == null || data.videos.length == 0)
					reject (url);
				else
					resolve (data.videos[0]);
			}).catch (e => {
				console.log (e);
				reject (url);
			});
		});
	}

	static load (url) {
		return new Promise ((resolve, reject) => {
			Hfr.fetch ("https://bzhdev18.alwaysdata.net/social/?url=" + encodeURIComponent (url)).then (rep => rep.json()).then (data => {
				if (data.error)
					reject (url);
				else
					resolve (Social.objectToString (data));
			}).catch (e => {
				console.log (e);
				reject (url);
			});
		});
	}

	static format (text) {
		return new Promise ((resolve, reject) => {
			Hfr.fetch ("https://bzhdev18.alwaysdata.net/social/?format=" + text).then (rep => rep.json()).then (data => {
				if (data.error)
					reject (url);
				else
					resolve (data.text);
			}).catch (e => {
				console.log (e);
				reject (url);
			});
		});
	}
}

class Widget {
	#list;
	#type;
	#data;
	
	constructor (type) {
		this.#type = type;
		this.element = document.createElement (type);
		this.#list = [];
		this.#data = {};
	}
	
	set (key, value) {
		this.element.setAttribute (key, value);
	}
	
	get (key) {
		return this.element.getAttribute (key);
	}
	
	setData (key, val) {
		this.#data[key] = val;
	}
	
	getData (key) {
		return this.#data[key];
	}
	
	get type() {
		return this.#type;
	}
	
	attach (widget) {
		var elmt = null;
		if (widget instanceof Widget)
			elmt = widget.element;
		else
			elmt = widget;
		elmt.parentElement.insertBefore (this.element, elmt);
	}
	
	destroy() {
		this.element.parentElement.removeChild (this.element);
	}
	
	connect (name, fct) {
		this.element.addEventListener (name, fct);
	}
	
	disconnect (name, fct) {
		this.element.removeEventListener (name, fct);
	}
	
	get children() { return this.#list; }
	
	add (widget) {
		for (var i = 0; i < this.#list.length; i++)
			if (this.#list[i] == widget)
				return false;
		this.element.appendChild (widget.element);
		this.#list.push (widget);
		return true;
	}
	
	remove (widget) {
		for (var i = 0; i < this.#list.length; i++)
			if (this.#list[i] == widget) {
				this.element.removeChild (widget.element);
				this.#list.splice (i, 1);
				return true;
			}
		return false;
	}
}

class Box extends Widget {
	#vrt;

	constructor (vertical = false) {
		super ("div");

		this.#vrt = vertical;
	}

	add (widget) {
		super.add (widget);
		if (this.#vrt == true)
			this.element.appendChild (document.createElement ("br"));
	}
	
	clear() {
		while (this.children.length > 0)
			this.remove (this.children[0]);
	}
}

class Scale extends Widget {
	constructor (min, max) {
		super ("input");
		this.set ("type", "range");
		this.set ("min", min);
		this.set ("max", max);
	}

	changed (callback) {
		this.element.addEventListener ("change", e => {
			callback (e.target.value);
		});
	}
}

class ScrolledWindow extends Widget {
	constructor() {
		super ("div");
		this.set ("style", "overflow-y : scroll; height : 150px; width : 200px");
	}
	
	get child() {
		return this.children[0];
	}
	
	set child (widget) {
		while (this.children.length > 0)
			this.remove (this.children[0]);
		this.add (widget);
	}
}

class Picture extends Widget {
	constructor (source) {
		super ("img");
		this.set ("src", source);
	}
	
	get source() {
		return this.get ("src");
	}
	
	set source (src) {
		this.set ("src", src);
	}
	
	get height() {
		return this.get ("height");
	}
	
	set height (n) {
		this.set ("height", n);
	}
	
	get width() {
		return this.get ("width");
	}
	
	set width (n) {
		this.set ("width", n);
	}
	
	loaded (callback) {
		this.element.addEventListener ("load", e => {
			this.width = e.target.width;
			this.height = e.target.height;
			callback(e.target.width, e.target.height);
		});
	}
}

class Label extends Widget {
	constructor (lbl) {
		super("label");
		this.text = lbl;
	}
	
	get text() {
		return this.element.textContent;
	}
	
	set text (val) {
		this.element.textContent = val;
	}
	
	for (id) {
		this.set ("for", id);
	}
}

class Input extends Widget {
	constructor (type) {
		super ("input");
		this.set ("type", type);
	}
}

class TextButton extends Widget {
	constructor (txt) {
		super ("button");
		this.text = txt;
	}
	
	get text() {
		return this.element.textContent;
	}
	
	set text (txt) {
		this.element.textContent = txt;
	}
	
	clicked (callback) {
		this.element.addEventListener ("click", e => { callback (this); });
	}
}

class Button extends Widget {
	#img;
	#lbl;
	#ipt;
	
	constructor (title) {
		super ("span");
		
		this.#img = new Picture ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAEg0lEQVR42mKAgVFgYmLyxtjY+D+l2MzM7ApZDgBq/rtx48b/s2fPBhu0/uRNYjFY/fz58/9v3rwZQHo1wMiWBdE14rVtc2zbtm3btm0b0dqKs+HaCr7tX1unkq9pvZ5JclqvcAq3bjU+X9w1gZSUFAJgsGb1S8WAfFZWFmVnZxPsaPJhYGBwPz+3YbhZW1vfpEJgdXWVhoaGdkUAmdvc3BQCb7755gsMH/5cwk7Xubw/ME4ZGRmdtLKyOmxubn6Mfx9UIZCbm0s5OTl6ESibeU/kHRwcyMzMTD6bmJgctbOzO+Lm5nYuMDCQYmNjKT09nVJTUykyMpL4d2IC+1UIzM3NUV9fnxipXPpcEew9fMnV1ZVCQkIoPj6eMjIyxFlycrI4Dg8PJ39/f/Lw8LgEkeeMHFAhUFZWRsXFxUKgdP4TRXjbwIDy8vLEkZ+fHxxogAICExMT1NXVJQQKZz5SAhAAaRhWBHd3d80EGhoaqKqqSgjkTn2gBCAAHRUnzs7OZG9vTzY2NhfQdNyAh9npae6P0yiTWgI4Ae3t7UIga/xdRTAwNKTKykriY0WWlpYwDP2z3GS/8+f3+b2ZT0Q0v5syXmICJ1EytQQ6OjqosbFR38lH5eXlxBESekjbHGCZ+7QS6O7upqamJjE8+dG3inDJMRum4eFhmYS7JjAwMEBtbW1CIL5vWxEMmUBpaakQQBPrImBqaqqZQGtrK9XV1QmB6O5NRTAyNhYCxvze29uriEB+fr7mY9jT0yMEwjvWFQEESkpKJAMLCwt7I4DoLx3D4NYVRTBmx5gDyEBnZ+feCCCCwcFBIRDQtKQIJqamVFRUJBnY2NjYGwEcJ9QTBHzqFxTB1NSMCgsLJQPNzc06CfCFpZkAIri0kHjWzinCJQIcmdqFhB29wZjgIfQ9v//KU/GURgIFBQUEKCXgUTUlBKCDDFRXV19N4Hp20s+OT/j6+l6Ijo6moKAgcnFxwaWlQuBmKCKC6elprQRcC3vIwj2IR7AR3wOGvAOYEyJCBj744APRhT120MLpPo5TNTk5ifkizRoXFyf7wNUEbmc8y4o/6xi7UMIiQd7e3nLnJyQkIBrc93h2Sea/e++914zfT2BCrq2t0fz8PGaEnLC0tDToqCwkNzLuZDzCeFIdnnjiCU82ehJGYBSnBSnHluPj4wPnx6APO2+88UakhYXF0ZqaGsgJMOTQ4Ng5uSQg8LdeSysrfMCKFzGsEBGMYm5gGcU2xOQOX9VPKXwNy8itra0VOZwwLK0xMTG4ps+z/Iy+/xuOIVrUEnVFRDDKpbhUgj8vyfL1+xbfksfQeJmZmXAMOdRfokd5WOZpfdf2s9jx0Ei4/5FOGIZRW1vb02y0awfhLW7CE1hKsa4FBweTk5PTRTjnbAZBRt8SfMab7zk0HjKBpRPp5A0IRg+9+uqr914t/9JLL93CpJvQN6x7nN+xpHyD7IjALgg8wjjItT3t5eVFnp6exDv+Kfymw+j13JT/TwrYYuLAJklqNIgALZwJxLeA+DyQ3wisA4QYhjIAACqkfZkBRe3AAAAAAElFTkSuQmCC");
		this.#img.set ("title", title);
		this.#img.set ("height", 20);
		this.#img.set ("class", "hfr-cc-button");
		this.#img.set ("style", "vertical-align : middle");
		
		this.#lbl = new Label ("");
		this.#lbl.add (this.#img);
		
		this.#ipt = new Input ("file");
		this.#ipt.set ("multiple", true);
		this.#ipt.set ("accept", "image/png,image/jpeg,image/bmp,image/gif,audio/*");
		this.#ipt.set ("style", "display : none");
		
		this.add (this.#lbl);
		this.add (this.#ipt);
	}
	
	for (id, area_id) {
		this.#lbl.for (id);
		this.#ipt.set ("id", id);
		this.#ipt.set ("data-textarea", area_id);
	}
	
	get image() { return this.#img; }
	
	changed (callback) {
		this.#ipt.connect ("change", evt => {
			var arr = [];
			for (var file of evt.target.files)
				arr.push (file);
			callback (arr); 
		});
	}
}

class Loading extends Picture {
	constructor() {
		super ("data:image/png;base64,R0lGODdhEAAQAHcAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJCgAAACwAAAAAEAAQAMIAAAAAAABmZmbMzMyZmZkAAAAAAAAAAAADIwi63EzEjeGAECAEMCvrXiiOH7WAZKoq2niVFSSZ68xRaK0nACH5BAkKAAAALAMAAwAKAAoAwgAAAGZmZpmZmQAAAMzMzAAAAAAAAAAAAAMcCAoRq4SAOCV9FQjxxsCgxjWAFz4XaklLCrFKAgAh+QQJCgAAACwDAAMACgAKAMIAAACZmZnMzMxmZmYAAAAAAAAAAAAAAAADGwgKEatCgDglfYCQ+sbAINcAXvhcj8YtKCQtCQAh+QQJCgAAACwDAAMACgAKAMIAAADMzMyZmZlmZmYAAAAAAAAAAAAAAAADGggKEauNOULkU2PYJcT9VtSBT3Rlm0JdppIAACH5BAkKAAAALAMAAwAKAAoAwgAAAMzMzJmZmWZmZgAAAAAAAAAAAAAAAAMbCAoRqw0QAsZg7gEh8ItaGI1ZuIAP5y2WNj0JACH5BAkKAAAALAMAAwAKAAoAwgAAAMzMzAAAAJmZmWZmZgAAAAAAAAAAAAMaCAoRq0IAQsAYzL3MV9sg932hpz1f9Fwb9SQAIfkECQoAAAAsAwADAAoACgDCAAAAzMzMAAAAZmZmmZmZAAAAAAAAAAAAAxoIChGrYwBCmBPiqWYf1yAnOuCDhU7kkQv1JAAh+QQJCgAAACwDAAMACgAKAMIAAADMzMwAAABmZmaZmZkAAAAAAAAAAAADGggKEauEMNfAGE9VIV7NIDeN4HOBVeQ565MAADs=");
	}
}

class Dialog extends Widget {
	#cnt;
	#ptit;
	#box;
	#span;
	#cbs;
	
	constructor () {
		super ("div");
		this.#cbs = [];
		var style = document.createElement ("style");
		style.textContent = `.modal {
			  display: none; /* Hidden by default */
			  position: fixed; /* Stay in place */
			  z-index: 1; /* Sit on top */
			  padding-top: 100px; /* Location of the box */
			  left: 0;
			  top: 0;
			  width: 100%; /* Full width */
			  height: 100%; /* Full height */
			  overflow: auto; /* Enable scroll if needed */
			  background-color: rgb(0,0,0); /* Fallback color */
			  background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
			  text-align : center;
			}
			
			.modal-content {
			  background-color: #fefefe;
			  margin: auto;
			  padding: 20px;
			  border: 1px solid #888;
			  width: auto;
			  display: inline-block;
			  text-align : center;
			}

			.close {
			  color: #aaaaaa;
			  float: right;
			  font-size: 28px;
			  font-weight: bold;
			}

			.close:hover,
			.close:focus {
			  color: #000;
			  text-decoration: none;
			  cursor: pointer;
			}`;
		document.head.appendChild (style);
		
		this.set ("class", "modal");
		
		var div = document.createElement ("div");
		div.setAttribute ("class", "modal-content");
		this.#span = document.createElement ("span");
		this.#span.setAttribute ("class", "close");
		var i = document.createElement ("img");
		i.setAttribute ("src", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAb1BMVEUAAAAaGhobGxsaGhoaGhobGxsZGRkbGxsaGhoaGhobGxsbGxsbGxsaGhoaGhoZGRkaGhocHBxSUlIaGhpTU1MaGhoaGhoaGhobGxsaGhpMTExJSUm5ubmvr6+urq63t7e2tra0tLSysrKxsbH+/v6zSTvuAAAAJHRSTlMAHSYnbXCChomKjo+QkpOXm5ubn5+kp6issLK1zc7Q0NHT1ddW0iqYAAAAcklEQVR42o3IVQLDIBCE4bi7ewLM/c/Y7VSe+dH9HJvcIPoWuIQw/hcSkjTt0pRXQsiyAUeWHRiyjFBV1Y1btnwItXQCz/slNNIFqFZeQt/3Glq2fAjjuMGMo8E2joRpnvd55jURiuVfTvCr9VvpORa9APAYCpORESOKAAAAAElFTkSuQmCC");
		this.#span.appendChild (i);
		div.appendChild (this.#span);
		
		this.#ptit = new Widget ("p");
		this.#ptit.set ("class", "title");
		div.appendChild (this.#ptit.element);
		
		div.appendChild (document.createElement ("br"));
		
		this.#cnt = new Widget ("div");
		div.appendChild (this.#cnt.element);
		
		div.appendChild (document.createElement ("br"));
		
		this.#box = new Widget ("div");
		div.appendChild (this.#box.element);
		
		this.element.appendChild (div);
		document.body.appendChild (this.element);
	}
	
	get title() {
		return this.#ptit.element.textContent;
	}
	
	set title (text) {
		this.#ptit.element.textContent = text;
	}
	
	get content() {
		return this.#cnt.children[0];
	}
	
	set content (widget) {
		if (this.#cnt.children.length > 0)
			this.#cnt.remove (this.#cnt.children[0]);
		this.#cnt.add (widget);
	}
	
	addButton (button) {
		this.#box.add (button);
	}
	
	display() {
		this.element.style.display = "block";
		for (var i = 0; i < this.#cbs.length; i++)
			this.#cbs[i](this);
	}
	
	hide() {
		this.element.style.display = "none";
	}
	
	get displayed() { return this.element.style.display == "block"; }
	
	shown (cb) {
		this.#cbs.push (cb);
	}
	
	closed (cb) {
		this.#span.addEventListener ("click", (e) => {
			cb (this);
		});
		window.addEventListener ("click", (e) => {
			if (e.target == this.element)
				cb (this);
		});
	}
}

class Builder {
	#txt
	
	constructor (init) {
		this.#txt = "";
		if (typeof (init) === "string")
			this.#txt = init;
	}
	
	append (str) {
		if (typeof (str) !== "string")
			return false;
		this.#txt += str;
		return true;
	}
	
	prepend (str) {
		if (typeof (str) !== "string")
			return false;
		this.#txt = str + this.#txt;
		return true;
	}
	
	toString() {
		return this.#txt;
	}
}

class BuilderAsync {
	#table
	
	constructor () {
		this.#table = [];
	}
	
	append (action) {
		if (typeof (action) == "string")
			this.#table.push (Promise.resolve (action));
		else
			this.#table.push (action);
	}
	
	toString() {
		return Promise.all(this.#table)
	}
}

class UploadService {
	isInvalid (file) {
		return file.size > 20000000;
	}

	uploadAsync (file) {
		return new Promise ((resolve, reject) => {
			this.upload (file, resolve, reject);
		});
	}
	
	static getService (service) {
		if (service == "rehost")
			return new Rehost();
		return new Imgur();
	}

	static getDefault() {
		var svc = Utils.getValue ("hfr-copie-colle-service");
		if (svc == "rehost")
			return new Rehost();
		return new Imgur();
	}
}

class Rehost extends UploadService {
	get name() { return "rehost"; }

	upload (file, resolve, reject) {
		var form = new FormData();
		form.append ("image", file);
		Utils.request ({
			method : "POST",
			data : form,
			url : "https://rehost.diberie.com/Host/UploadFiles?SelectedAlbumId=undefined&PrivateMode=false&SendMail=false&KeepTags=&Comment=&SelectedExpiryType=0",
			onabort : function() { reject ("envoi annulé"); }, 
			ontimeout : function() { reject ("délai dépassé"); },
			onerror : function (response) {
				reject ("erreur lors de l'envoi d'image");
			},
			onload : function (response) {
				try {
					var object = JSON.parse (response.responseText);
					resolve ({
						gif : object.isGIF == true ? true : false,
						url : object.picURL,
						width : object.previewWidht,
						height : object.previewHeight
					});
				}
				catch (e) {
					reject (e);
				}
			}
		});
	}
}

class Imgur extends UploadService {
	get name() { return "imgur"; }

	upload (file, resolve, reject) {
		var form = new FormData();
		form.append ("image", file);
		Utils.request ({
			method : "POST",
			data : form,
			headers : {		
				"Authorization" : "Client-ID d1619618d2ac442"
			},
			url : "https://api.imgur.com/3/image",
			onabort : function() { reject ("envoi annulé"); }, 
			ontimeout : function() { reject ("délai dépassé"); },
			onerror : function (response) {
				reject ("erreur lors de l'envoi d'image");
			},
			onload : function (response) {
				var object = JSON.parse (response.responseText);
				if (!object.success) {
					reject (object);
					return;
				}
				resolve ({
					hash : object.data.deletehash,
					delete : function (callback) {
						Utils.request ({
							method : "DELETE",
							headers : {		
								"Authorization" : "Client-ID d1619618d2ac442"
							},
							url : "https://api.imgur.com/3/image/" + this.hash,
							onerror : function (response) {
								console.log (response);
							},
							onload : function (response) {
								var result = JSON.parse (response.responseText);
								if (result.success) {
									callback();
								}
							}
						});
					},
					gif : object.data.type == "image/gif",
					url : object.data.link,
					width : object.data.width,
					height : object.data.height
				});
			}
		});
	}
}

class Utils {
	static #hdialog;
	
	static set hashDialog (dialog) { Utils.#hdialog = dialog; }
	
	static get hashDialog() { return Utils.#hdialog; }
	
	static isMac() {
		const userAgent = window.navigator.userAgent;
		const platform = window.navigator?.userAgentData?.platform || window.navigator.platform;
	}
	
	static addCss (url) {
		var head = document.getElementsByTagName('head')[0];
		if (!head) { return; }
		var link = document.createElement ("link");
		link.setAttribute ("rel", "stylesheet");
		link.setAttribute ("href", url);
		head.appendChild (link);
	}
	
	static addJs (url, module) {
		var head = document.getElementsByTagName('head')[0];
		var script = document.createElement ("script");
		script.setAttribute ("src", url);
		if (module)
			script.setAttribute ("type", "module");
		head.appendChild (script);
	}
	
	static processFiles (area, files) {
		if (files == null || files.length == 0)
			return;
		Utils.processFile (area, files[0]).then (() => {
			files.shift();
			Utils.processFiles (area, files);
		}).catch (e => { console.log (e); });
	}
	
	static processFile (area, file) {
		return new Promise ((resolve, reject) => {
			var loading = new Loading();
			loading.attach (area);
			if (file.type.indexOf ("audio/") == 0) {
				area.disabled = true;
				Utils.dropGofile (item).then (url => {
					Utils.insertText (area, "[url]" + url + "[/url]");
					loading.destroy();
					area.disabled = false;
					resolve();
				}).catch (e => {
					loading.destroy();
					area.disabled = false;
					reject (e);
				});
			}
			else if (file.type.indexOf ("image/") == 0) {
				area.disabled = true;
				Utils.dropImage (file).then (Utils.displayImage).then (bbcode => {
					loading.destroy();
					area.disabled = false;
					Utils.insertText (area, bbcode);
					resolve();
				}).catch (e => {
					loading.destroy();
					area.disabled = false;
					console.log (e);
					reject (e);
				});
			}
		});
	}
	
	static addButtonToTextarea (event) {
		var num = -1;
		if (event.target.id.indexOf ("rep_editin_") == 0) {
			num = parseInt(event.target.id.split ("rep_editin_")[1]);
		}
		var file_id = "hfr-cc-file" + (num == -1 ? "" : "-" + num);
		var form = event.target.form;
		if (form == null)
			form = event.target.parentElement;
		var btn = form.querySelector("input[type=\"button\"], input[type=\"submit\"]");
		if (btn.parentElement.querySelector (".hfr-cc-button"))
			return;
		var button = new Button ("Sélectionnez une image");
		button.for (file_id, event.target.id);
		button.changed (files => {
			Utils.processFiles (event.target, files);
		});
		button.attach (btn);
	}
	
	static isGM4() {
		return typeof (GM) === "object" && typeof (GM.info) === "object" && GM.info.scriptHandler == "Greasemonkey" && parseFloat(GM.info.version) >= 4;
	}
	
	static insertText (textarea, text) {
		var start = textarea.selectionStart;
		var end = textarea.selectionEnd;
		textarea.value = textarea.value.substr (0, start) + text + textarea.value.substr (end);
		textarea.setSelectionRange (start + text.length, start + text.length);
	}
	
	static request (object) {
		if (Utils.isGM4())
			return GM.xmlHttpRequest (object);
		else
			return GM_xmlhttpRequest (object);
	}
	
	static convertVideoURL (url) {
		return new Promise ((resolve, reject) => {
			Hfr.fetch (url).then (rep => rep.blob()).then (blob => resolve (URL.createObjectURL (blob))).catch (e => {
				console.log (e);
				reject (url);
			});
		});
	}
	
	static setValue (key, data) {
		if (!Utils.isGM4()) {
			GM_setValue (key, data);
			return;
		}
		if (typeof (data) === "object")
			localStorage.setItem (GM.info.script.name + " :: " + key, JSON.stringify (data));
		else
			localStorage.setItem (GM.info.script.name + " :: " + key, data);
	}
	
	static getValue (key, default_value) {
		if (!Utils.isGM4())
			return GM_getValue (key, default_value);
		var rk = GM.info.script.name + " :: " + key;
		if (!localStorage.hasOwnProperty (rk))
			return default_value;
		var data = localStorage.getItem (rk);
		try {
			var obj = JSON.parse (data);
			return obj;
		}
		catch(e) {}
		return data;	
	}
	
	static registerCommand (title, callback) {
		if (Utils.isGM4())
			GM.registerMenuCommand (title, callback);
		else
			GM_registerMenuCommand (title, callback);
	}

	static dropText (text) {
		return new Promise ((resolve, reject) => {
			(async () => {
				Social.load (text).then (str => resolve (str)).catch (e => {
					Embed.load (text).then (embed => resolve (embed.toString()))
						.catch (err => {
							Social.format (text).then (txt => resolve (txt)).catch (error => {
								console.log (error);
								reject (text);
							});
						});
				});
			})();
		});
	}
	
	static pasteHtml (item) {
		return new Promise ((resolve, reject) => {
			(async () => {
				var blob = await item.getType ("text/html");
				var text = await blob.text();
				var doc = new DOMParser().parseFromString (text, "text/html");
				var sel = doc.querySelectorAll ("span[id^='docs-internal-guid'] > span > img");
				if (sel.length == 1) {
					var url = sel.item (0).getAttribute ("src");
					var bbcode = "[url=https://rehost.diberie.com/Rehost?url=" + url + "][img]https://rehost.diberie.com/Rehost?size=min&url=" + url + "[/img][/url]";
					resolve (bbcode);
				}
				else
					reject (text);
			})();
		});
	}

	static getImageInfo (url) {
		return new Promise ((resolve, reject) => {
			(async () => {
				var img = new Image();
				img.onload = function() {
					resolve ({width: img.width, height: img.height});
				};
				img.onerror = function() {
					reject (url);
				};
				img.src = url;
			})();
		});
	}
	
	static pasteText (item) {
		return new Promise ((resolve, reject) => {
			(async () => {
				var blob = await item.getType ("text/plain");
				var text = await blob.text();

				Social.load (text).then (str => resolve (str)).catch (e => {
					Embed.load (text).then (embed => resolve (embed.toString()))
						.catch (err => {
							Social.format (text).then (txt => resolve (txt)).catch (error => {
								console.log (error);
								reject (text);
							});
						});
				});
			})();
		});
	}
	
	static uploadGofile (file, resolve, reject) {
		if (file.size > 20000000) {
			reject("fichier trop gros");
			return;
		}
		var form = new FormData();
		form.append ("file", file);
		Utils.request ({
			method : "POST",
			url : "https://fastupload.io/upload",
			data : form,
			onabort : function() { reject(""); }, 
			ontimeout : function() { reject(""); },
			onerror : function() { reject(""); },
			onload : function (rep) {
				console.log (rep.responseText);
				resolve ("ok");
			}
		});
	}
	
	static pasteGofile (item, type) {
		return new Promise ((resolve, reject) => {
			(async () => {
				var blob = await item.getType (type);
				Utils.uploadGofile (blob, resolve, reject);
			})();
		});
	}
	
	static dropGofile (file) {
		return new Promise ((resolve, reject) => {
			(async () => {
				Utils.uploadGofile (file, resolve, reject);
			})();
		});
	}
	
	static uploadImage (file, res, rej) {
		var service = UploadService.getDefault();
		if (service.isInvalid (file)) {
			rej ("fichier invalid pour ls service " + service.name);
			return;
		}
		service.upload (file, res, rej);
	}
	
	static pasteImage (item, type) {
		return new Promise ((resolve, reject) => {
			(async () => {
				var blob = await item.getType (type);
				Utils.uploadImage (blob, resolve, reject);
			})();
		});
	}
	
	static dropImage (file) {
		return new Promise ((resolve, reject) => {
			(async () => {
				Utils.uploadImage (file, resolve, reject);
			})();
		});
	}
	
	static registerImage (data) {
		var images = {};
		if (localStorage.hasOwnProperty ("hfr-cc-images")) {
			try {
				images = JSON.parse (localStorage.getItem ("hfr-cc-images"));
				if (Array.isArray (images))
					images = {};
			}
			catch (e) {
				console.log(e);
				images = {};
			}
		}
		images[data.deletehash] = data;
		localStorage.setItem ("hfr-cc-images", JSON.stringify (images));
	}
	
	static unregisterImage (hash) {
		var images = {};
		if (localStorage.hasOwnProperty ("hfr-cc-images")) {
			try {
				images = JSON.parse (localStorage.getItem ("hfr-cc-images"));
				if (Array.isArray (images))
					images = {};
			}
			catch (e) {
				console.log(e);
				images = {};
			}
		}
		if (images.hasOwnProperty (hash))
			delete images[hash];
		localStorage.setItem ("hfr-cc-images", JSON.stringify (images));
	}
	
	static listImages() {
		var images = {};
		if (localStorage.hasOwnProperty ("hfr-cc-images")) {
			try {
				images = JSON.parse (localStorage.getItem ("hfr-cc-images"));
				if (Array.isArray (images))
					images = {};
			}
			catch (e) {
				console.log(e);
				images = {};
			}
		}
		var l = [];
		for (var k of Object.keys (images))
			l.push (images[k]);
		return l;
	}
	
	static bstroke (event) {
		if (event.code == "KeyD" && event.ctrlKey && event.altKey) {
			// a refaire
		}
	}
	
	static isGDoc (item) {
		if (item.types.length != 1)
			return false;
		return item.types[0] == "text/html";
	}
	
	static stroke (event) {
		console.log (event);
		var loading = new Loading();
		if (event.code == "KeyD" && event.ctrlKey && event.altKey) {
			// a refaire
		}
		else if (event.code == "KeyV" && (event.ctrlKey && navigator.platform.indexOf ("Mac") != 0 || event.metaKey && navigator.platform.indexOf ("Mac") == 0)) {
			if (event.shiftKey) {
				return;
			}
			if (!navigator?.clipboard?.read)
				alert ("navigator.clipboard.read : fonction non présente ou non activée.\nVous êtes sur Firefox : suivre ce lien https://forum.hardware.fr/hfr/Discussions/Viepratique/scripts-infos-news-sujet_116015_240.htm#t67904757")
			else
				navigator.clipboard.read().then(array => {
					for (var item of array) {
						console.log (item.types);
						if (Utils.isGDoc (item)) {
							event.target.disabled = true;
							loading.attach (event.target);
							Utils.pasteHtml (item).then (bbcode => {
								Utils.insertText (event.target, bbcode);
								loading.destroy();
								event.target.disabled = false;
								event.target.focus();
							}).catch (e => {
								Utils.insertText (event.target, e);
								loading.destroy();
								event.target.disabled = false;
								event.target.focus();
							});
						}
						else if (item.types.indexOf ("text/plain") >= 0) {
							event.target.disabled = true;
							loading.attach (event.target);
							Utils.pasteText (item).then (text => {
								Utils.insertText (event.target, text);
								loading.destroy();
								event.target.disabled = false;
								event.target.focus();
							}).catch (e => {
								Utils.insertText (event.target, e);
								loading.destroy();
								event.target.disabled = false;
								event.target.focus();
							});
						}
						else
							for (var type of item.types) {
								if (type.indexOf ("audio/") == 0) {
									event.target.disabled = true;
									loading.attach (event.target);
									Utils.uploadGofile (item, type).then (url => {
										Utils.insertText (event.target, "[url]" + url + "[/url]");
										loading.destroy();
										event.target.disabled = false;
										event.target.focus();
									}).catch (e => {
										loading.destroy();
										event.target.disabled = false;
										event.target.focus();
										console.log (e);
									});
									break;
								}
								else if (type.indexOf ("image/") == 0) {
									event.target.disabled = true;
									loading.attach (event.target);
									Utils.pasteImage (item, type).then (upload => {
										if (event.altKey) {
											Utils.insertText (event.target, "[url=" + upload.url + "][img]" + upload.url + "[/img][/url]");	
											loading.destroy();
											event.target.disabled = false;
											event.target.focus();
										}
										else
											Utils.displayImage (upload).then (bbcode => {
												Utils.insertText (event.target, bbcode);
												loading.destroy();
												event.target.disabled = false;
												event.target.focus();
											}).catch (e => {
												console.log (e);
												loading.destroy();
												event.target.disabled = false;
												event.target.focus();
											});
									}).catch (e => {
										loading.destroy();
										event.target.disabled = false;
										event.target.focus();
										console.log (e);
									});
									break;
								}
							}
					}
				}).catch(e => {
					console.log (e);
				});
			event.preventDefault();
		}
	}

	static allowDrop (event) {
		event.preventDefault();
	}
	
	static stringIsGIF (str) {
		try {
			var url = new URL (str);
			return url.pathname.endsWith(".gif");
		}
		catch {}
		return false;
	}

	static displayImage (upload) {
		console.log (upload);
		return new Promise ((res, rej) => {
			var dialog = new Dialog();
			dialog.closed (d => { d.destroy(); rej ("annulé"); });
			dialog.title = "prévisualisation de l'image";
			var src = upload.url;
			var button = new TextButton ("400 px");
			var img = new Picture (src);
			var scale = new Scale (100, 800);
			var box = new Box (true);
			var hbox = new Box();
			hbox.add (scale);
			hbox.add (button);
			box.add (hbox);
			box.add (img);
			img.loaded ((w,h) => {
				if (w > 800) {
					img.height = Math.floor (800 * h / w);
					img.width = 800;
				}
				if (h > 800) {
					img.width = Math.floor (800 * w / h);
					img.height = 800;
				}
				button.set ("bbcode", `[url=${upload.url}][img=${img.width},${img.height}]${upload.url}[/img][/url]`);
			});
			dialog.content = box;
			scale.changed (val => {
				var w = img.width, h = img.height;
				img.height = val;
				img.width = Math.floor (val*w/h);
				button.text = `${val} px`;
				button.set ("bbcode", `[url=${upload.url}][img=${img.width},${img.height}]${upload.url}[/img][/url]`);
			});
			scale.set ("value", 400);
			
			button.clicked (self => { dialog.destroy(); res (button.get ("bbcode")); });
			dialog.display();
		});
	}
	
	static drop (event) {
		event.preventDefault();
		var loading = new Loading();
		var dt = event.dataTransfer;
		if (dt.items.length == 0)
			return;
		var hf = false, hu = false;
		for (var i = 0; i < dt.items.length; i++)
			if (dt.items[i].kind == "file")
				hf = true;
		var uri = event.dataTransfer.getData ("text/uri-list");
		if (uri != null)
			hu = true;
		if (hu && Utils.stringIsGIF (uri)) {
			Utils.insertText (event.target, "[url=" + uri + "][img]https://rehost.diberie.com/Rehost?url=" + uri + "[/img][/url]");	
			
		}
		else if (hf) {
			for (var i = 0; i < dt.items.length; i++) {
				var item = dt.items[i];
				if (item.type == "application/x-moz-nativeimage") {
					alert ("Vous êtes sur Firefox et la fonctionnalité de glisser des images entre les onglets n'est pas activée\nsuivre ce lien https://forum.hardware.fr/hfr/Discussions/Viepratique/scripts-infos-news-sujet_116015_265.htm#t71266097");
				}
				if (item.type.indexOf ("audio/") == 0) {
					event.target.disabled = true;
					loading.attach (event.target);
					Utils.dropGofile (item.getAsFile()).then (url => {
						Utils.insertText (event.target, "[url]" + url + "[/url]");
						loading.destroy();
						event.target.disabled = false;
					}).catch (e => {
						loading.destroy();
						event.target.disabled = false;
						console.log (e);
					});
				}
				else if (item.type.indexOf ("image/") == 0) {
					event.target.disabled = true;
					loading.attach (event.target);
					Utils.dropImage (item.getAsFile()).then (upload => {
						if (event.altKey) {
							var src = upload.url;
							Utils.insertText (event.target, "[url=" + upload.url + "][img]" + src + "[/img][/url]");	
							loading.destroy();
							event.target.disabled = false;
						}
						else {
							Utils.displayImage (upload).then (bbcode => {
								Utils.insertText (event.target, bbcode);
								loading.destroy();
								event.target.disabled = false;
							}).catch (e => {
								loading.destroy();
								event.target.disabled = false;
								console.log (e);
							});
						}
					}).catch (e => {
						loading.destroy();
						event.target.disabled = false;
						console.log (e);
					});
				}
			}
		} 
		else
			for (var i = 0; i < dt.items.length; i++) {
				var item = dt.items[i];
				 if (item.type == "text/plain") {
					event.target.disabled = true;
					loading.attach (event.target);
					item.getAsString (str => {
						Utils.dropText (str).then (text => {
							Utils.insertText (event.target, text);
							loading.destroy();
							event.target.disabled = false;
						}).catch (e => {
							console.log (e);
							Utils.insertText (event.target, e);
							loading.destroy();
							event.target.disabled = false;
						});
					});
				}
			}
	}
}

Utils.registerCommand ("Copie/Colle -> choix du service", () => {
	var service = prompt ("Entrez ici le service d'image désiré (imgur, ou rehost)", Utils.getValue ("hfr-copie-colle-service", ""));
	if (service == "imgur" || service == "rehost")
		Utils.setValue ("hfr-copie-colle-service", service);
});

Utils.registerCommand ("Copie/Colle -> détail des liens", () => {
	var detail = prompt ("Entrez ici si vous voulez le détail des liens collés (oui ou non) ('non' par défaut)", Utils.getValue ("hfr-copie-colle-detail", "non"));
	Utils.setValue ("hfr-copie-colle-detail", (detail == "oui") ? "oui" : "non");
});


Utils.addCss ("https://vjs.zencdn.net/8.0.4/video-js.css");
Utils.addJs ("https://vjs.zencdn.net/8.0.4/video.js");
Utils.addJs ("https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js", true);

document.addEventListener ("keydown", Utils.bstroke);	

var index = 0;

for (var textarea of document.querySelectorAll ("textarea")) {
	textarea.addEventListener('keydown', Utils.stroke);
	textarea.addEventListener('drop', Utils.drop);
	textarea.addEventListener('dragover', Utils.allowDrop);
	textarea.addEventListener('focus', Utils.addButtonToTextarea);
}

var observer = new MutationObserver ((mutations, observer) => {
	for (var textarea of document.querySelectorAll("textarea")) {
		textarea.removeEventListener('keydown', Utils.stroke, false); 
		textarea.addEventListener('keydown', Utils.stroke, false);
		textarea.removeEventListener('drop', Utils.drop, false); 
		textarea.addEventListener('drop', Utils.drop, false); 
		textarea.removeEventListener('dragover', Utils.allowDrop, false); 
		textarea.addEventListener('dragover', Utils.allowDrop, false); 
		textarea.removeEventListener('focus', Utils.addButtonToTextarea, false);
		textarea.addEventListener('focus', Utils.addButtonToTextarea, false);
	}
	
	document.querySelectorAll (".cLink").forEach (function (link) {
		if (typeof (link.getAttribute ("href")) !== "string")
			return;
		var href = link.getAttribute ("href");
		if (href[0] == '/')
			href = "https://forum.hardware.fr" + href;
		var u = new URL (href);
		if (u.hostname == "store10.gofile.io" && u.pathname.indexOf ("/download") == 0 && u.searchParams.get("isAudio") == "true") {
			var audio = document.createElement ("audio");
			audio.setAttribute ("src", href);
			audio.setAttribute ("controls", "controls");
			link.parentNode.replaceChild (audio, link);
		}
		if (link.firstElementChild == null || link.firstElementChild.nodeName.toLowerCase() != "img")
			return;
		if (u.searchParams.has ("hfr-cc-threads")) {
			var video = link.createPlayer (false);
			Social.getFirstVideo (u.searchParams.get ("hfr-cc-threads")).then (obj => {
				video.player.src ({ src : obj.source, type : obj.content_type });
			})
		}
		else if (href.indexOf ("https://video.twimg.com") == 0) {
				var mime = u.searchParams.get ("hfr-cc-mime-type");
				var video = link.createPlayer (u.searchParams.get("gif") == "true");
			Utils.convertVideoURL (href).then (datauri => {
				video.player.src ({ src : datauri, type : mime  });
			});
		}
		else if (u.searchParams.has ("hfr-cc-mime-type")) {
			var mime = u.searchParams.get ("hfr-cc-mime-type");
			var video = link.createPlayer (u.searchParams.get("gif") == "true");
			video.player.src ({ src : href, type : mime  });
		}
	});
});
observer.observe(document, {attributes: false, childList: true, characterData: false, subtree: true});
	
document.querySelectorAll (".cLink").forEach (function (link) {
	if (typeof (link.getAttribute ("href")) !== "string")
		return;
	var href = link.getAttribute ("href");
	if (href[0] == '/')
		href = "https://forum.hardware.fr" + href;
	var u = null;
	try {
		u = new URL (href);
	}
	catch {
		return;
	}
	if (u.hostname == "store10.gofile.io" && u.pathname.indexOf ("/download") == 0 && u.searchParams.get("isAudio") == "true") {
		var audio = document.createElement ("audio");
		audio.setAttribute ("src", href);
		audio.setAttribute ("controls", "controls");
		link.parentNode.replaceChild (audio, link);
	}
	if (link.firstElementChild == null || link.firstElementChild.nodeName.toLowerCase() != "img")
		return;
	if (u.searchParams.has ("hfr-cc-threads")) {
			var video = link.createPlayer (false);
		Social.getFirstVideo (u.searchParams.get ("hfr-cc-threads")).then (obj => {
			console.log ("recharge video");
			video.player.src ({ src : obj.source, type : obj.content_type });
		})
	}
	else if (href.indexOf ("https://video.twimg.com") == 0) {
			var mime = u.searchParams.get ("hfr-cc-mime-type");
			var video = link.createPlayer (u.searchParams.get("gif") == "true");
		Utils.convertVideoURL (href).then (datauri => {
			video.player.src ({ src : datauri, type : mime  });
		});
	}
	else if (u.searchParams.has ("hfr-cc-mime-type")) {
		var mime = u.searchParams.get ("hfr-cc-mime-type");
		var video = link.createPlayer (u.searchParams.get("gif") == "true");
		video.player.src ({ src : href, type : mime  });
	}
});
