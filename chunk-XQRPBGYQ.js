import{H as R,J as V,K as q,L as s}from"./chunk-YFEJXRFE.js";import{$ as O,aa as P,b as F,d as j,f as z,g as Q}from"./chunk-V6XIDGU7.js";import{Cb as g,Db as w,Eb as D,Fb as y,Hb as v,Ib as _,Ja as i,P as b,Pb as c,Qb as N,Rb as S,S as C,U as l,Yb as E,Za as h,bb as I,cb as k,db as r,ma as u,pb as a,qb as f,rb as m,sb as x,sc as A,wb as B,xb as M}from"./chunk-NVCWASPR.js";var G=`
    .p-tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: dt('tag.primary.background');
        color: dt('tag.primary.color');
        font-size: dt('tag.font.size');
        font-weight: dt('tag.font.weight');
        padding: dt('tag.padding');
        border-radius: dt('tag.border.radius');
        gap: dt('tag.gap');
    }

    .p-tag-icon {
        font-size: dt('tag.icon.size');
        width: dt('tag.icon.size');
        height: dt('tag.icon.size');
    }

    .p-tag-rounded {
        border-radius: dt('tag.rounded.border.radius');
    }

    .p-tag-success {
        background: dt('tag.success.background');
        color: dt('tag.success.color');
    }

    .p-tag-info {
        background: dt('tag.info.background');
        color: dt('tag.info.color');
    }

    .p-tag-warn {
        background: dt('tag.warn.background');
        color: dt('tag.warn.color');
    }

    .p-tag-danger {
        background: dt('tag.danger.background');
        color: dt('tag.danger.color');
    }

    .p-tag-secondary {
        background: dt('tag.secondary.background');
        color: dt('tag.secondary.color');
    }

    .p-tag-contrast {
        background: dt('tag.contrast.background');
        color: dt('tag.contrast.color');
    }
`;var J=["icon"],K=["*"];function L(t,d){if(t&1&&x(0,"span",4),t&2){let e=g(2);c(e.cx("icon")),a("ngClass",e.icon)("pBind",e.ptm("icon"))}}function U(t,d){if(t&1&&(B(0),r(1,L,1,4,"span",3),M()),t&2){let e=g();i(),a("ngIf",e.icon)}}function W(t,d){}function X(t,d){t&1&&r(0,W,0,0,"ng-template")}function Y(t,d){if(t&1&&(f(0,"span",2),r(1,X,1,0,null,5),m()),t&2){let e=g();c(e.cx("icon")),a("pBind",e.ptm("icon")),i(),a("ngTemplateOutlet",e.iconTemplate||e._iconTemplate)}}var Z={root:({instance:t})=>["p-tag p-component",{"p-tag-info":t.severity==="info","p-tag-success":t.severity==="success","p-tag-warn":t.severity==="warn","p-tag-danger":t.severity==="danger","p-tag-secondary":t.severity==="secondary","p-tag-contrast":t.severity==="contrast","p-tag-rounded":t.rounded}],icon:"p-tag-icon",label:"p-tag-label"},H=(()=>{class t extends R{name="tag";style=G;classes=Z;static \u0275fac=(()=>{let e;return function(n){return(e||(e=u(t)))(n||t)}})();static \u0275prov=b({token:t,factory:t.\u0275fac})}return t})();var $=new C("TAG_INSTANCE"),Ct=(()=>{class t extends q{$pcTag=l($,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=l(s,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}styleClass;severity;value;icon;rounded;iconTemplate;templates;_iconTemplate;_componentStyle=l(H);onAfterContentInit(){this.templates?.forEach(e=>{e.getType()==="icon"&&(this._iconTemplate=e.template)})}static \u0275fac=(()=>{let e;return function(n){return(e||(e=u(t)))(n||t)}})();static \u0275cmp=h({type:t,selectors:[["p-tag"]],contentQueries:function(o,n,T){if(o&1&&(y(T,J,4),y(T,O,4)),o&2){let p;v(p=_())&&(n.iconTemplate=p.first),v(p=_())&&(n.templates=p)}},hostVars:2,hostBindings:function(o,n){o&2&&c(n.cn(n.cx("root"),n.styleClass))},inputs:{styleClass:"styleClass",severity:"severity",value:"value",icon:"icon",rounded:[2,"rounded","rounded",A]},features:[E([H,{provide:$,useExisting:t},{provide:V,useExisting:t}]),k([s]),I],ngContentSelectors:K,decls:5,vars:6,consts:[[4,"ngIf"],[3,"class","pBind",4,"ngIf"],[3,"pBind"],[3,"class","ngClass","pBind",4,"ngIf"],[3,"ngClass","pBind"],[4,"ngTemplateOutlet"]],template:function(o,n){o&1&&(w(),D(0),r(1,U,2,1,"ng-container",0)(2,Y,2,4,"span",1),f(3,"span",2),N(4),m()),o&2&&(i(),a("ngIf",!n.iconTemplate&&!n._iconTemplate),i(),a("ngIf",n.iconTemplate||n._iconTemplate),i(),c(n.cx("label")),a("pBind",n.ptm("label")),i(),S(n.value))},dependencies:[Q,F,j,z,P,s],encapsulation:2,changeDetection:0})}return t})();export{Ct as a};
