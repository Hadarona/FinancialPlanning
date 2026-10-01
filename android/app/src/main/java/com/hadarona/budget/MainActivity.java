package com.hadarona.budget;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final int PICK_FILE = 40;
    private WebView web;
    private LinearLayout root;
    private String origin;
    private ValueCallback<Uri[]> fileCallback;
    private SharedPreferences preferences;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("budget", MODE_PRIVATE);
        origin = ServerAddress.normalize(preferences.getString("server", ""));
        if (origin == null) showSetup(); else showBudget(state);
    }
    private LinearLayout layout() {
        LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.VERTICAL);
        view.setBackgroundColor(Color.WHITE);
        view.setOnApplyWindowInsetsListener((v,insets)->{
            android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
            v.setPadding(bars.left,bars.top,bars.right,bars.bottom); return insets;
        });
        return view;
    }
    private Button button(int text) { Button b=new Button(this);b.setText(text);return b; }
    private void showSetup() {
        if(web!=null){web.destroy();web=null;}
        root=layout();setContentView(root);
        TextView heading=new TextView(this);heading.setText(R.string.connect_title);heading.setTextSize(28);heading.setPadding(24,40,24,16);root.addView(heading);
        TextView help=new TextView(this);help.setText(R.string.connect_help);help.setPadding(24,8,24,16);root.addView(help);
        EditText address=new EditText(this);address.setSingleLine(true);address.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);address.setHint(R.string.server_hint);address.setText(origin==null?"":origin);root.addView(address);
        if(origin!=null){TextView note=new TextView(this);note.setText(R.string.change_server);root.addView(note);}
        Button connect=button(R.string.connect);root.addView(connect);connect.setOnClickListener(v->{
            String normalized=ServerAddress.normalize(address.getText().toString());
            if(normalized==null){address.setError(getString(R.string.invalid_url));return;}
            if(normalized.equals(origin)){showBudget(null);return;}
            CookieManager.getInstance().removeAllCookies(removed->{
                CookieManager.getInstance().flush();origin=normalized;preferences.edit().putString("server",origin).apply();showBudget(null);
            });
        });
    }
    @SuppressLint("SetJavaScriptEnabled")
    private void showBudget(Bundle state) {
        if(web!=null)web.destroy();
        root=layout();setContentView(root);
        Button settings=button(R.string.server);root.addView(settings);settings.setOnClickListener(v->showSetup());
        web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        WebSettings settingsWeb=web.getSettings();settingsWeb.setJavaScriptEnabled(true);settingsWeb.setDomStorageEnabled(true);
        settingsWeb.setAllowFileAccess(false);settingsWeb.setAllowContentAccess(false);settingsWeb.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                String url=request.getUrl().toString();
                if(ServerAddress.sameOrigin(origin,url))return false;
                if("https".equals(request.getUrl().getScheme())){
                    try{startActivity(new Intent(Intent.ACTION_VIEW,request.getUrl()));}catch(android.content.ActivityNotFoundException ignored){}
                }
                return true;
            }
            @Override public void onPageFinished(WebView view,String url){CookieManager.getInstance().flush();}
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())showOffline();}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
                Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.setType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");pick.addCategory(Intent.CATEGORY_OPENABLE);
                try{startActivityForResult(pick,PICK_FILE);}catch(android.content.ActivityNotFoundException error){fileCallback.onReceiveValue(null);fileCallback=null;}
                return true;
            }
        });
        if(state==null||web.restoreState(state)==null)web.loadUrl(origin+"/budget");
    }
    private void showOffline(){
        if(web==null || web.getVisibility()==View.GONE)return;
        web.setVisibility(View.GONE);
        TextView text=new TextView(this);text.setText(R.string.offline);text.setPadding(24,40,24,16);root.addView(text);
        Button retry=button(R.string.retry);root.addView(retry);retry.setOnClickListener(v->showBudget(null));
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==PICK_FILE&&fileCallback!=null){Uri uri=data==null?null:data.getData();fileCallback.onReceiveValue(result==RESULT_OK&&uri!=null&&"content".equals(uri.getScheme())?new Uri[]{uri}:null);fileCallback=null;}
    }
    @Override protected void onPause(){super.onPause();CookieManager.getInstance().flush();}
    @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);if(web!=null&&web.getParent()!=null)web.saveState(state);}
    @Override public void onBackPressed(){if(web!=null&&web.getVisibility()==View.VISIBLE&&web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);if(web!=null)web.destroy();super.onDestroy();}
}
