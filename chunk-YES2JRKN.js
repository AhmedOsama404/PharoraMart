function a(e,s){let t=e.target;if(!(!t||t.tagName!=="IMG")){if(!t.dataset.fb){t.dataset.fb="1",t.src=`https://picsum.photos/seed/${s}/900/675`;return}t.classList.add("img-gone")}}export{a};
