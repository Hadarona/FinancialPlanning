package com.hadarona.budget;
import android.content.Context;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class MainActivityTest {
 @Before public void clear(){RuntimeEnvironment.getApplication().getSharedPreferences("budget",Context.MODE_PRIVATE).edit().clear().commit();}
 private <T extends View> T find(View view,Class<T> type){
  if(type.isInstance(view))return type.cast(view);
  if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++){T found=find(group.getChildAt(i),type);if(found!=null)return found;}}
  return null;
 }
 @Test public void firstLaunchRequiresHttpsAddress(){
  try(var controller=Robolectric.buildActivity(MainActivity.class).setup()){
   MainActivity activity=controller.get();View root=activity.getWindow().getDecorView();
   EditText address=find(root,EditText.class);assertNotNull(address);assertNull(find(root,WebView.class));
   address.setText("http://unsafe.example");find(root,Button.class).performClick();
   assertNotNull(address.getError());assertNull(find(activity.getWindow().getDecorView(),WebView.class));
  }
 }
 @Test public void rememberedServerLoadsSecureWebViewAndCanReturnToSetup(){
  RuntimeEnvironment.getApplication().getSharedPreferences("budget",Context.MODE_PRIVATE).edit().putString("server","https://budget.example").commit();
  try(var controller=Robolectric.buildActivity(MainActivity.class).setup()){
   MainActivity activity=controller.get();WebView web=find(activity.getWindow().getDecorView(),WebView.class);assertNotNull(web);
   assertEquals("https://budget.example/budget",shadowOf(web).getLastLoadedUrl());
   assertTrue(web.getSettings().getJavaScriptEnabled());assertTrue(web.getSettings().getDomStorageEnabled());
   assertFalse(web.getSettings().getAllowFileAccess());assertFalse(web.getSettings().getAllowContentAccess());
   assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,web.getSettings().getMixedContentMode());
   find(activity.getWindow().getDecorView(),Button.class).performClick();shadowOf(Looper.getMainLooper()).idle();
   EditText address=find(activity.getWindow().getDecorView(),EditText.class);assertEquals("https://budget.example",address.getText().toString());
   assertNull(find(activity.getWindow().getDecorView(),WebView.class));
  }
 }
 @Test public void malformedSavedAddressReturnsToSetup(){
  RuntimeEnvironment.getApplication().getSharedPreferences("budget",Context.MODE_PRIVATE).edit().putString("server","javascript:alert(1)").commit();
  try(var controller=Robolectric.buildActivity(MainActivity.class).setup()){
   assertNotNull(find(controller.get().getWindow().getDecorView(),EditText.class));
   assertNull(find(controller.get().getWindow().getDecorView(),WebView.class));
  }
 }
}
