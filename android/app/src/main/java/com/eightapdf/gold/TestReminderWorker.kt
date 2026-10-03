package com.eightapdf.gold

import android.app.*
import android.content.*
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.util.*

class TestReminderWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = try {
        val snap = FirebaseFirestore.getInstance().collection("announcements").whereEqualTo("published", true).get().await()
        snap.documents.forEach { doc ->
            val data = doc.data ?: return@forEach
            val category = data["category"].toString().lowercase()
            val title = data["title"].toString()
            if (!category.contains("test") && !title.lowercase().contains("test") && !title.lowercase().contains("exam")) return@forEach
            val event = (data["eventDate"] as? com.google.firebase.Timestamp)?.toDate() ?: return@forEach
            schedule(applicationContext, doc.id, title, data["subject"]?.toString().orEmpty(), event)
        }
        Result.success()
    } catch (_: Exception) { Result.retry() }

    private fun schedule(context: Context, id: String, title: String, subject: String, testDate: Date) {
        val reminder = Calendar.getInstance().apply { time = testDate; add(Calendar.DATE, -1); set(Calendar.HOUR_OF_DAY, 16); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
        if (reminder.timeInMillis <= System.currentTimeMillis()) return
        val intent = Intent(context, TestReminderReceiver::class.java).putExtra(NotificationSupport.EXTRA_TITLE, title).putExtra(NotificationSupport.EXTRA_SUBJECT, subject.ifBlank { "your" })
        val pi = PendingIntent.getBroadcast(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val alarm = context.getSystemService(AlarmManager::class.java)
        if (android.os.Build.VERSION.SDK_INT >= 31 && alarm.canScheduleExactAlarms()) alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.timeInMillis, pi) else alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.timeInMillis, pi)
    }
}
