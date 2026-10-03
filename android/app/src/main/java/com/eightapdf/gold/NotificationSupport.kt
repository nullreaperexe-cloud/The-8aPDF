package com.eightapdf.gold

import android.app.*
import android.content.*
import android.os.Build
import java.text.SimpleDateFormat
import java.util.*

object NotificationSupport {
    const val DAILY_CHANNEL = "daily_motivation"
    const val TEST_CHANNEL = "test_reminders"
    const val CONTENT_CHANNEL = "new_content"
    const val ACTION_DAILY = "com.eightapdf.gold.DAILY"
    const val ACTION_TEST = "com.eightapdf.gold.TEST"
    const val EXTRA_SUBJECT = "subject"
    const val EXTRA_TITLE = "title"

    fun channels(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannels(listOf(
            NotificationChannel(DAILY_CHANNEL, "Daily motivation", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "Daily study motivation at 4 PM" },
            NotificationChannel(TEST_CHANNEL, "Test reminders", NotificationManager.IMPORTANCE_HIGH).apply { description = "Reminders for upcoming tests" },
            NotificationChannel(CONTENT_CHANNEL, "New PDFs and announcements", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "New content published on 8aPDF" }
        ))
    }

    fun show(context: Context, channel: String, title: String, body: String, destination: String = "home") {
        channels(context)
        val open = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).putExtra("destination", destination).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pi = PendingIntent.getActivity(context, (title + body).hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = Notification.Builder(context, channel).setSmallIcon(com.eightapdf.gold.R.drawable.ic_launcher_gold).setContentTitle(title).setContentText(body).setStyle(Notification.BigTextStyle().bigText(body)).setContentIntent(pi).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).build()
        context.getSystemService(NotificationManager::class.java).notify((title + body).hashCode(), n)
    }

    fun dateKey(): String = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date())
}

object Schedules {
    private const val REQUEST_DAILY = 8001
    fun daily(context: Context) {
        val alarm = context.getSystemService(AlarmManager::class.java)
        val intent = PendingIntent.getBroadcast(context, REQUEST_DAILY, Intent(context, DailyMotivationReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val cal = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 16); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0); if (before(Calendar.getInstance())) add(Calendar.DATE, 1) }
        if (Build.VERSION.SDK_INT >= 31 && alarm.canScheduleExactAlarms()) alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, intent)
        else alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, intent)
    }
}
