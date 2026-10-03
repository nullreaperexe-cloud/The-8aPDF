package com.eightapdf.gold
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
class BootReceiver : BroadcastReceiver() { override fun onReceive(context: Context, intent: Intent?) { NotificationSupport.channels(context); Schedules.daily(context) } }
