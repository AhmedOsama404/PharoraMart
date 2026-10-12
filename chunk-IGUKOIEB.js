import{H as $,J as z,K as G,L as T,M as J}from"./chunk-YFEJXRFE.js";import{$ as P,E as A,Z as O,_ as H,aa as V,d as R,f as q,g as w}from"./chunk-V6XIDGU7.js";import{Cb as y,Db as k,Eb as b,Fb as c,Hb as d,Ib as s,Ja as r,Ob as N,P as B,Pb as f,Qb as M,Rb as x,S as I,U as g,Yb as j,Za as F,bb as S,cb as D,db as p,ha as Q,ma as v,pb as i,qb as u,rb as _,wb as C,xb as E,yb as h}from"./chunk-NVCWASPR.js";var K=`
    .p-card {
        background: dt('card.background');
        color: dt('card.color');
        box-shadow: dt('card.shadow');
        border-radius: dt('card.border.radius');
        display: flex;
        flex-direction: column;
    }

    .p-card-caption {
        display: flex;
        flex-direction: column;
        gap: dt('card.caption.gap');
    }

    .p-card-body {
        padding: dt('card.body.padding');
        display: flex;
        flex-direction: column;
        gap: dt('card.body.gap');
    }

    .p-card-title {
        font-size: dt('card.title.font.size');
        font-weight: dt('card.title.font.weight');
    }

    .p-card-subtitle {
        color: dt('card.subtitle.color');
    }
`;var W=["header"],X=["title"],Y=["subtitle"],Z=["content"],ee=["footer"],te=["*",[["p-header"]],[["p-footer"]]],ne=["*","p-header","p-footer"];function ie(t,l){t&1&&h(0)}function ae(t,l){if(t&1&&(u(0,"div",1),b(1,1),p(2,ie,1,0,"ng-container",2),_()),t&2){let e=y();f(e.cx("header")),i("pBind",e.ptm("header")),r(2),i("ngTemplateOutlet",e.headerTemplate||e._headerTemplate)}}function re(t,l){if(t&1&&(C(0),M(1),E()),t&2){let e=y(2);r(),x(e.header)}}function oe(t,l){t&1&&h(0)}function le(t,l){if(t&1&&(u(0,"div",1),p(1,re,2,1,"ng-container",3)(2,oe,1,0,"ng-container",2),_()),t&2){let e=y();f(e.cx("title")),i("pBind",e.ptm("title")),r(),i("ngIf",e.header&&!e._titleTemplate&&!e.titleTemplate),r(),i("ngTemplateOutlet",e.titleTemplate||e._titleTemplate)}}function pe(t,l){if(t&1&&(C(0),M(1),E()),t&2){let e=y(2);r(),x(e.subheader)}}function ce(t,l){t&1&&h(0)}function de(t,l){if(t&1&&(u(0,"div",1),p(1,pe,2,1,"ng-container",3)(2,ce,1,0,"ng-container",2),_()),t&2){let e=y();f(e.cx("subtitle")),i("pBind",e.ptm("subtitle")),r(),i("ngIf",e.subheader&&!e._subtitleTemplate&&!e.subtitleTemplate),r(),i("ngTemplateOutlet",e.subtitleTemplate||e._subtitleTemplate)}}function se(t,l){t&1&&h(0)}function me(t,l){t&1&&h(0)}function fe(t,l){if(t&1&&(u(0,"div",1),b(1,2),p(2,me,1,0,"ng-container",2),_()),t&2){let e=y();f(e.cx("footer")),i("pBind",e.ptm("footer")),r(2),i("ngTemplateOutlet",e.footerTemplate||e._footerTemplate)}}var ue=`
    ${K}

    .p-card {
        display: block;
    }
`,_e={root:"p-card p-component",header:"p-card-header",body:"p-card-body",caption:"p-card-caption",title:"p-card-title",subtitle:"p-card-subtitle",content:"p-card-content",footer:"p-card-footer"},L=(()=>{class t extends ${name="card";style=ue;classes=_e;static \u0275fac=(()=>{let e;return function(n){return(e||(e=v(t)))(n||t)}})();static \u0275prov=B({token:t,factory:t.\u0275fac})}return t})();var U=new I("CARD_INSTANCE"),Ae=(()=>{class t extends G{$pcCard=g(U,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=g(T,{self:!0});_componentStyle=g(L);onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}header;subheader;set style(e){A(this._style(),e)||(this._style.set(e),this.el?.nativeElement&&e&&Object.keys(e).forEach(o=>{this.el.nativeElement.style[o]=e[o]}))}get style(){return this._style()}styleClass;headerFacet;footerFacet;headerTemplate;titleTemplate;subtitleTemplate;contentTemplate;footerTemplate;_headerTemplate;_titleTemplate;_subtitleTemplate;_contentTemplate;_footerTemplate;_style=Q(null);getBlockableElement(){return this.el.nativeElement.children[0]}templates;onAfterContentInit(){this.templates.forEach(e=>{switch(e.getType()){case"header":this._headerTemplate=e.template;break;case"title":this._titleTemplate=e.template;break;case"subtitle":this._subtitleTemplate=e.template;break;case"content":this._contentTemplate=e.template;break;case"footer":this._footerTemplate=e.template;break;default:this._contentTemplate=e.template;break}})}static \u0275fac=(()=>{let e;return function(n){return(e||(e=v(t)))(n||t)}})();static \u0275cmp=F({type:t,selectors:[["p-card"]],contentQueries:function(o,n,m){if(o&1&&(c(m,O,5),c(m,H,5),c(m,W,4),c(m,X,4),c(m,Y,4),c(m,Z,4),c(m,ee,4),c(m,P,4)),o&2){let a;d(a=s())&&(n.headerFacet=a.first),d(a=s())&&(n.footerFacet=a.first),d(a=s())&&(n.headerTemplate=a.first),d(a=s())&&(n.titleTemplate=a.first),d(a=s())&&(n.subtitleTemplate=a.first),d(a=s())&&(n.contentTemplate=a.first),d(a=s())&&(n.footerTemplate=a.first),d(a=s())&&(n.templates=a)}},hostVars:4,hostBindings:function(o,n){o&2&&(N(n._style()),f(n.cn(n.cx("root"),n.styleClass)))},inputs:{header:"header",subheader:"subheader",style:"style",styleClass:"styleClass"},features:[j([L,{provide:U,useExisting:t},{provide:z,useExisting:t}]),D([T]),S],ngContentSelectors:ne,decls:8,vars:11,consts:[[3,"pBind","class",4,"ngIf"],[3,"pBind"],[4,"ngTemplateOutlet"],[4,"ngIf"]],template:function(o,n){o&1&&(k(te),p(0,ae,3,4,"div",0),u(1,"div",1),p(2,le,3,5,"div",0)(3,de,3,5,"div",0),u(4,"div",1),b(5),p(6,se,1,0,"ng-container",2),_(),p(7,fe,3,4,"div",0),_()),o&2&&(i("ngIf",n.headerFacet||n.headerTemplate||n._headerTemplate),r(),f(n.cx("body")),i("pBind",n.ptm("body")),r(),i("ngIf",n.header||n.titleTemplate||n._titleTemplate),r(),i("ngIf",n.subheader||n.subtitleTemplate||n._subtitleTemplate),r(),f(n.cx("content")),i("pBind",n.ptm("content")),r(2),i("ngTemplateOutlet",n.contentTemplate||n._contentTemplate),r(),i("ngIf",n.footerFacet||n.footerTemplate||n._footerTemplate))},dependencies:[w,R,q,V,J,T],encapsulation:2,changeDetection:0})}return t})();export{Ae as a};
