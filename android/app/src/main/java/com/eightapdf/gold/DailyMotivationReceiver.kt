package com.eightapdf.gold
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
class DailyMotivationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val quote = QuoteRepository.next(context, NotificationSupport.dateKey())
        if (quote.isNotBlank()) NotificationSupport.show(context, NotificationSupport.DAILY_CHANNEL, "8aPDF — Daily Motivation", quote)
        Schedules.daily(context)
    }
}
