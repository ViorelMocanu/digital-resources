const body = document.body;

// definim media query-ul care delimitează rezoluția deasupra căreia vrem să afișăm detaliile fără collapse/expand
const mql = window.matchMedia("(min-width: 750px)");
showFullProducts(mql.matches);
// la fiecare modificare a window-ului...
mql.addEventListener("change", (event) => {
	// rulăm funcția care schimbă atributele de open când se schimbă valoarea de adevăr a match-ului de media query
	showFullProducts(event.matches);
});

/* @TODO: fix content flicker issues on <details> */
// inspirat de https://zobzn.com/js-push-state-listener
let pse = document.createElement("script");
pse.setAttribute("id", "pushStateExpansion");
pse.text = "(" +
	function () {
		// injected DOM script is not a content script anymore,
		// it can modify objects and functions of the page
		var _pushState = history.pushState;
		history.pushState = function (state, title, url) {
			_pushState.call(this, state, title, url);
			window.dispatchEvent(new CustomEvent("state-changed", { state }));
		};
		var _replaceState = history.replaceState;
		history.replaceState = function (state, title, url) {
			_replaceState.call(this, state, title, url);
			window.dispatchEvent(new CustomEvent("state-changed", { state }));
		};
	} +
")();";
document.head.appendChild(pse);
document.getElementById('pushStateExpansion').remove(); // remove the DOM script element

// And here content script listens to our DOM script custom events
window.addEventListener("state-changed", function (e) {
	console.info("History state changed");
	showFullProducts(mql.matches);
});

window.appliedOpenAttribute = false;
function showFullProducts(isDesktop) {
	const resources = document.getElementsByClassName('ResourceMain');
	// dacă booleanul e truthish
	if (isDesktop) {
		// păstrăm atributul open peste tot
		for (let i = 0; i < resources.length; i++) {
			resources[i].setAttribute('open', '');
		}
		window.appliedOpenAttribute = true;
	} else {
		// altfel, îl scoatem
		for (let i = 0; i < resources.length; i++) {
			resources[i].removeAttribute('open');
		}
		window.appliedOpenAttribute = false;
	}
}

let lastScrollTop = 0;
// elementul ar trebui înlocuit cu adevăratul element țintă sau cu window dacă nu există element țintă
window.addEventListener("scroll", function () {
	let st = window.scrollY || document.documentElement.scrollTop;
	if (st > lastScrollTop) {
		body.classList.add('ScrollDown');
	} else if (st < lastScrollTop) {
		// dacă se dă scroll în sus
		body.classList.remove('ScrollDown');
	} else {
		 // aici pare c-a fost alt fel de scroll (orizontal?)
		body.classList.remove('ScrollDown');
	}
	lastScrollTop = st <= 0 ? 0 : st; // pentru scrolling mobil sau negativ
}, false);