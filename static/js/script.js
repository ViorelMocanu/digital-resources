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

let lastScrollTop = 0;
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