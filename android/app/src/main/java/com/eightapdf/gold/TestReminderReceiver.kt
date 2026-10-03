package com.eightapdf.gold
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
class TestReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val subject = intent?.getStringExtra(NotificationSupport.EXTRA_SUBJECT).orEmpty().ifBlank { "your test" }
        val title = intent?.getStringExtra(NotificationSupport.EXTRA_TITLE).orEmpty().ifBlank { "Test" }
        NotificationSupport.show(context, NotificationSupport.TEST_CHANNEL, "📚 8aPDF — TEST TOMORROW!", "Padhle bhaiii! 😂 Kal tera $subject test hai. Revision karle!", "announcement:$title")
    }
}
