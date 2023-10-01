const body = document.body;

// definim media query-ul care delimitează rezoluția deasupra căreia vrem să afișăm detaliile fără collapse/expand
const mql = window.matchMedia("(min-width: 750px)");
showFullProducts(mql.matches);
// la fiecare modificare a window-ului...
mql.addEventListener("change", (event) => {
	// rulăm funcția care schimbă atributele de open când se schimbă valoarea de adevăr a match-ului de media query
	showFullProducts(event.matches);
});
/* @TODO: fix content flicker issues on <details>
window.addEventListener("pushstate", (event) => {
	alert('111');
	showFullProducts(mql.matches);
});
*/
function showFullProducts(isDesktop) {
	const resources = document.getElementsByClassName('ResourceMain');
	// dacă booleanul e truthish
	if (isDesktop) {
		// păstrăm atributul open peste tot
		for (let i = 0; i < resources.length; i++) {
			resources[i].setAttribute('open', '');
		}
	} else {
		// altfel, îl scoatem
		for (let i = 0; i < resources.length; i++) {
			resources[i].removeAttribute('open');
		}
	}
}

let lastScrollTop = 0;
// elementul ar trebui înlocuit cu adevăratul element țintă sau cu window dacă nu există element țintă
window.addEventListener("scroll", function () { // or window.addEventListener("scroll"....
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