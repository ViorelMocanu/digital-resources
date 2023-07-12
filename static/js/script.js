const menuTrigger = document.getElementById('menuTrigger');
const body = document.body;
// la fiecare click pe butonul cu hamburger icon, adăugăm sau scoatem (deci facem toggle pe) clasa ActiveMenu în body, clasă care are niște CSS care afișează sau ascunde meniul mobil
menuTrigger.addEventListener('click', function (event) {
	event.preventDefault();
	body.classList.toggle('ActiveMenu');
	return false;
});


const filterOptions = document.getElementsByClassName('FilterOptions');
// Parcurgem fiecare buton cu clasa FilterOptions și adăugăm pe el un eveniment de click.
for (let i = 0; i < filterOptions.length; i++) {
	filterOptions[i].addEventListener('click', function (event) {
		// La fiecare click, vedem dacă există butoane care au deja proprietatea `open`.
		const alreadyOpen = document.querySelector('.FilterOptions[open]');
		// Dacă se găsesc astfel de butoane și ele sunt diferite de cel pe care am dat click acum, trebuie scos atributul `open` de pe ele ca să nu se suprapună.
		if (alreadyOpen !== null && alreadyOpen != filterOptions[i])
			alreadyOpen.removeAttribute('open');
		return true;
	});
}

// definim media query-ul care delimitează rezoluția deasupra căreia vrem să afișăm detaliile fără collapse/expand
const mql = window.matchMedia("(min-width: 750px)");
showFullProducts(mql.matches);
// la fiecare modificare a window-ului...
mql.addEventListener("change", (event) => {
	// rulăm funcția care schimbă atributele de open când se schimbă valoarea de adevăr a match-ului de media query
	showFullProducts(event.matches);
});
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
// @TODO NICE: tradu comentariile de mai jos
// element should be replaced with the actual target element on which you have applied scroll, use window in case of no target element.
window.addEventListener("scroll", function () { // or window.addEventListener("scroll"....
	let st = window.scrollY || document.documentElement.scrollTop; // Credits: "https://github.com/qeremy/so/blob/master/so.dom.js#L426"
	if (st > lastScrollTop) {
		body.classList.add('ScrollDown');
	} else if (st < lastScrollTop) {
		// upscroll code
		body.classList.remove('ScrollDown');
	} else {
		 // else was horizontal scroll
		body.classList.remove('ScrollDown');
	}
	lastScrollTop = st <= 0 ? 0 : st; // For Mobile or negative scrolling
}, false);